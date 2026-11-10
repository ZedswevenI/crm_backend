import mongoose from 'mongoose';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExamQns from '../models/mockExamQns.model.js';
import MockExam from '../models/mockExam.model.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Batch from '../models/batch.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';
import { resolveBatchId } from '../helpers/batch.helper.js';

const sumFromSections = (result, field) => {
  const secs = result.sectionResults || [];
  const hasAny = secs.some((s) => s[field] !== null && s[field] !== undefined);
  if (!hasAny) return null;
  return secs.reduce((sum, s) => sum + (toNum(s[field]) || 0), 0);
};

const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
};

const populateStudentNames = async (tenantId, rows) => {
  if (!rows || rows.length === 0) return [];
  const studentIds = rows.map((r) => r.studentId).filter(Boolean);
  const admissionNos = rows.map((r) => r.admissionNo).filter(Boolean);

  const profiles = await StudentProfile.find(
    {
      tenantId,
      $or: [{ studentId: { $in: studentIds } }, { admissionNo: { $in: admissionNos } }]
    },
    { studentId: 1, admissionNo: 1, 'student.name': 1 }
  ).lean();

  const profileMap = new Map();
  for (const p of profiles) {
    if (p.studentId) profileMap.set(String(p.studentId), p.student?.name);
    if (p.admissionNo) profileMap.set(String(p.admissionNo), p.student?.name);
  }

  return rows.map((r) => ({
    ...r,
    studentName: profileMap.get(String(r.studentId)) || profileMap.get(String(r.admissionNo)) || 'Unknown'
  }));
};

const pickTid = (req) => safeTrim(req.body?.entiId || req.body?.tenantId);
const round2 = (n) => Math.round(Number(n) * 100) / 100;
// const normArr = (v) => (Array.isArray(v) ? v.map((x) => safeTrim(x)).filter(Boolean) : []);
const normArr = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => safeTrim(x)).filter(Boolean);
  if (typeof v === 'string')
    return v
      .split(';')
      .map((x) => safeTrim(x))
      .filter(Boolean);
  return [];
};
const sameSet = (a, b) => {
  const A = new Set(normArr(a));
  const B = new Set(normArr(b));
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
};

// const buildCorrectAnswer = (q) => {
//   const qt = safeTrim(q?.questionType).toLowerCase();
//   const opts = Array.isArray(q?.questionOptions) ? q.questionOptions : [];
//   if (qt === 'mcq_single') {
//     const one = opts.find((o) => o?.isCorrect === true);
//     return safeTrim(one?.key || one?.textHtml || '').toUpperCase();
//   }
//   if (qt === 'mcq_multi')
//     return opts
//       .filter((o) => o?.isCorrect)
//       .map((o) => safeTrim(o?.key || o?.textHtml || '').toUpperCase())
//       .filter(Boolean);
//   return null;
// };

const buildCorrectAnswer = (q) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const opts = Array.isArray(q?.questionOptions) ? q.questionOptions : [];
  if (qt === 'mcq_single' || qt === 'true_false') {
    const one = opts.find((o) => o?.isCorrect === true);
    return one ? safeTrim(one?.key || one?.textHtml || '').toUpperCase() : safeTrim(String(q?.correctAnswer || '')).toUpperCase() || null;
  }
  if (qt === 'mcq_multi') {
    const fromOpts = opts
      .filter((o) => o?.isCorrect)
      .map((o) => safeTrim(o?.key || o?.textHtml || '').toUpperCase())
      .filter(Boolean);
    return fromOpts.length ? fromOpts : normArr(q?.correctAnswer).map((x) => x.toUpperCase());
  }
  if (qt === 'passage_qns') {
    const correctOpts = opts.filter((o) => o?.isCorrect === true);
    if (correctOpts.length === 1) {
      return safeTrim(correctOpts[0]?.key || correctOpts[0]?.textHtml || '').toUpperCase();
    }
    if (correctOpts.length > 1) {
      return correctOpts.map((o) => safeTrim(o?.key || o?.textHtml || '').toUpperCase()).filter(Boolean);
    }
    return null;
  }
  return q?.correctAnswer ?? null;
};

// const parseMatrixAnswer = (str) => {
//   const map = new Map();
//   if (!str) return map;
//   const pairs = String(str).split(';');
//   for (const pair of pairs) {
//     const [key, val] = pair.split(':').map((s) => safeTrim(s));
//     if (key && val) map.set(key.toUpperCase(), val.toUpperCase());
//   }
//   return map;
// };

const parseMatrixAnswer = (str) => {
  // Returns Map { leftKey → string[] } — array of right keys student selected
  // Handles:
  //   "A:P;B:QR"  — A matched to P, B matched to Q and R
  //   "A:P;B:Q"   — single match per left key
  const map = new Map();
  if (!str) return map;

  String(str)
    .split(';')
    .forEach((pair) => {
      const [rawKey, rawVal] = pair.split(':').map((s) => safeTrim(s));
      if (rawKey && rawVal) {
        const lKey = rawKey.toUpperCase();
        // Each char of rawVal is a right key e.g. "PQ" → ["P","Q"]
        // const rKeys = rawVal.toUpperCase().split('').filter(Boolean);
        const rKeys = rawVal
          .toUpperCase()
          .split(',')
          .flatMap((part) => part.split('').filter(Boolean))
          .filter((k) => /^[A-Z]$/.test(k));
        map.set(lKey, rKeys);
      }
    });

  return map;
};

// const parseMatrixCorrect = (str) => {
//   const map = new Map();
//   if (!str) return map;
//   String(str)
//     .split(';')
//     .forEach((pair) => {
//       const matchWithMarks = pair.match(/^([^:]+):([^(]+)\(([^)]+)\)$/);
//       if (matchWithMarks) {
//         const lKey = safeTrim(matchWithMarks[1]).toUpperCase();
//         const rKeys = safeTrim(matchWithMarks[2]).toUpperCase();
//         const marks = toNum(matchWithMarks[3]);
//         if (!map.has(lKey)) map.set(lKey, []);
//         for (const rKey of rKeys.split('').filter(Boolean)) {
//           map.get(lKey).push({ value: rKey, marks });
//         }
//         return;
//       }
//       const [rawKey, rawVal] = pair.split(':').map((s) => safeTrim(s));
//       if (rawKey && rawVal) {
//         const lKey = rawKey.toUpperCase();
//         if (!map.has(lKey)) map.set(lKey, []);
//         for (const rKey of rawVal.toUpperCase().split('').filter(Boolean)) {
//           map.get(lKey).push({ value: rKey, marks: 0 });
//         }
//       }
//     });
//   return map;
// };

const parseMatrixCorrect = (str) => {
  // Handles:
  //   "A:P,T(2,1);B:R(2,1)"   — multiple right keys grouped per left key (new)
  //   "A:P(2,1);A:T(2,1)"     — one entry per pair (old, still supported)
  //   "A:PQ(2)"               — concatenated no comma (legacy)
  const map = new Map();
  if (!str) return map;

  String(str)
    .split(';')
    .forEach((pair) => {
      // Match: A:P,T(2,1) or A:P(2,1) or A:PQ(2) or A:P(2,-1)
      const matchWithMarks = pair.match(/^([^:]+):([^(]+)\(([^,)]+)(?:,([^)]+))?\)$/);
      if (matchWithMarks) {
        const lKey = safeTrim(matchWithMarks[1]).toUpperCase();
        const rKeysRaw = safeTrim(matchWithMarks[2]).toUpperCase(); // "P,T" or "P" or "PQ"
        const marks = toNum(matchWithMarks[3]);
        const negMark = matchWithMarks[4] !== undefined ? toNum(matchWithMarks[4]) : 0;
        if (!map.has(lKey)) map.set(lKey, []);
        // Split by comma first (new format), then each part char by char (legacy)
        const rKeyParts = rKeysRaw.split(',').filter(Boolean);
        for (const part of rKeyParts) {
          // Each part could be single "P" or legacy concatenated "PQ"
          for (const rKey of part.split('').filter(Boolean)) {
            map.get(lKey).push({ value: rKey, marks, negMark });
          }
        }
        return;
      }

      // Fallback: A:PQ or A:P (no marks brackets at all)
      const [rawKey, rawVal] = pair.split(':').map((s) => safeTrim(s));
      if (rawKey && rawVal) {
        const lKey = rawKey.toUpperCase();
        if (!map.has(lKey)) map.set(lKey, []);
        for (const rKey of rawVal.toUpperCase().split('').filter(Boolean)) {
          map.get(lKey).push({ value: rKey, marks: 0, negMark: 0 });
        }
      }
    });

  return map;
};

const parseRange = (str) => {
  if (!str) return null;
  const match = String(str).match(/^(-?[\d.]+)-(-?[\d.]+)$/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
};

const evalAnswer = (q, answerRaw) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const correct = buildCorrectAnswer(q);
  const pos = toNum(q?.positiveMarks);
  const neg = toNum(q?.negativeMarks);
  if (answerRaw === null || answerRaw === undefined) {
    return { isCorrect: null, correctAnswerRaw: correct ?? q?.correctAnswer ?? null, marksAwarded: 0 };
  }
  // ── mcq_single ───────────────────────────────────────────────────────────
  if (qt === 'mcq_single') {
    const a = safeTrim(answerRaw).toUpperCase();
    if (!a) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
    const ok = a === safeTrim(correct).toUpperCase();
    let marks = ok ? pos : neg ? -Math.abs(neg) : 0;
    // partial marking not applicable for mcq_single but guard anyway
    if (!ok && q?.hasPartialMarking) {
      const opt = (q.questionOptions || []).find((o) => safeTrim(o?.key).toUpperCase() === a || safeTrim(o?.textHtml).toUpperCase() === a);
      if (opt && toNum(opt.partialMark) > 0) marks = toNum(opt.partialMark);
    }
    return { isCorrect: ok, correctAnswerRaw: correct, marksAwarded: marks };
  }
  // ── true_false ────────────────────────────────────────────────────────────
  if (qt === 'true_false') {
    const normalize = (val) => {
      if (val === true) return 'true';
      if (val === false) return 'false';
      const v = String(val ?? '')
        .trim()
        .toLowerCase();
      if (['true', 't', '1', 'yes', 'y'].includes(v)) return 'true';
      if (['false', 'f', '0', 'no', 'n'].includes(v)) return 'false';
      return null;
    };
    const answer = normalize(answerRaw);
    const correctNorm = normalize(q?.correctAnswer);
    if (answer === null || correctNorm === null) {
      return { isCorrect: null, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: 0 };
    }
    const ok = answer === correctNorm;
    return { isCorrect: ok, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0 };
  }
  if (qt === 'mcq_multi') {
    // normalize student answer — accept both string "A;B" and array ["A","B"]
    const a = normArr(answerRaw).map((x) => x.toUpperCase());
    if (!a.length) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };

    const c = Array.isArray(correct) ? correct.map((x) => x.toUpperCase()) : [];
    const opts = q.questionOptions || [];

    // Full correct check
    const ok = sameSet(a, c);
    if (ok) return { isCorrect: true, correctAnswerRaw: correct, marksAwarded: pos };

    // Check if any wrong option selected
    const hasWrong = a.some((key) => {
      const opt = opts.find((o) => safeTrim(o?.key).toUpperCase() === key);
      return opt && !opt.isCorrect;
    });

    if (hasWrong) {
      // NTA: full negative penalty for any wrong selection
      return { isCorrect: false, correctAnswerRaw: correct, marksAwarded: neg ? -Math.abs(neg) : 0 };
    }

    // No wrong — subset of correct options selected
    if (q?.hasPartialMarking) {
      let partial = 0;
      for (const key of a) {
        const opt = opts.find((o) => safeTrim(o?.key).toUpperCase() === key);
        if (opt?.isCorrect && toNum(opt.partialMark) > 0) partial += toNum(opt.partialMark);
      }
      if (partial > 0) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: partial };
    }

    // Subset correct but no partial marking configured
    return { isCorrect: false, correctAnswerRaw: correct, marksAwarded: neg ? -Math.abs(neg) : 0 };
  }
  if (qt === 'passage_qns') {
    const correctOpts = (q.questionOptions || []).filter((o) => o?.isCorrect === true);
    if (correctOpts.length <= 1) {
      // Treat as mcq_single
      const a = safeTrim(answerRaw).toUpperCase();
      if (!a) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
      const ok = a === safeTrim(Array.isArray(correct) ? correct[0] : correct).toUpperCase();
      let marks = ok ? pos : neg ? -Math.abs(neg) : 0;
      if (!ok && q?.hasPartialMarking) {
        const opt = (q.questionOptions || []).find((o) => safeTrim(o?.key).toUpperCase() === a || safeTrim(o?.textHtml).toUpperCase() === a);
        if (opt && toNum(opt.partialMark) > 0) marks = toNum(opt.partialMark);
      }
      return { isCorrect: ok, correctAnswerRaw: correct, marksAwarded: marks };
    } else {
      // Treat as mcq_multi — same NTA logic
      const a = normArr(answerRaw).map((x) => x.toUpperCase());
      if (!a.length) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
      const c = Array.isArray(correct) ? correct.map((x) => x.toUpperCase()) : [];
      const opts = q.questionOptions || [];

      const ok = sameSet(a, c);
      if (ok) return { isCorrect: true, correctAnswerRaw: correct, marksAwarded: pos };

      const hasWrong = a.some((key) => {
        const opt = opts.find((o) => safeTrim(o?.key).toUpperCase() === key);
        return opt && !opt.isCorrect;
      });

      if (hasWrong) {
        return { isCorrect: false, correctAnswerRaw: correct, marksAwarded: neg ? -Math.abs(neg) : 0 };
      }

      if (q?.hasPartialMarking) {
        let partial = 0;
        for (const key of a) {
          const opt = opts.find((o) => safeTrim(o?.key).toUpperCase() === key);
          if (opt?.isCorrect && toNum(opt.partialMark) > 0) partial += toNum(opt.partialMark);
        }
        if (partial > 0) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: partial };
      }

      return { isCorrect: false, correctAnswerRaw: correct, marksAwarded: neg ? -Math.abs(neg) : 0 };
    }
  }
  if (qt === 'numeric') {
    const val = Number(String(answerRaw).trim());
    if (!Number.isFinite(val)) {
      return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: neg ? -Math.abs(neg) : 0 };
    }
    const mn = q?.numericMin != null ? toNum(q.numericMin) : null;
    const mx = q?.numericMax != null ? toNum(q.numericMax) : null;
    const ok = mn !== null && mx !== null ? val >= mn && val <= mx : safeTrim(String(answerRaw)) === safeTrim(String(q?.correctAnswer || ''));
    return {
      isCorrect: ok,
      correctAnswerRaw: q?.correctAnswer ?? null,
      marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
    };
  }
  // ── integer ───────────────────────────────────────────────────────────────
  if (qt === 'integer') {
    const val = parseInt(String(answerRaw).trim(), 10);
    if (!Number.isFinite(val)) {
      return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: neg ? -Math.abs(neg) : 0 };
    }
    const correctVal = parseInt(String(q?.correctAnswer || '').trim(), 10);
    const ok = Number.isFinite(correctVal) && val === correctVal;
    return {
      isCorrect: ok,
      correctAnswerRaw: q?.correctAnswer ?? null,
      marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
    };
  }
  // ── short_answer / subjective ─────────────────────────────────────────────
  if (qt === 'short_answer' || qt === 'subjective') {
    const studentAns = safeTrim(String(answerRaw)).toLowerCase();
    const correctAns = safeTrim(String(q?.correctAnswer || '')).toLowerCase();
    if (!studentAns) {
      return { isCorrect: null, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: 0 };
    }
    // Range check — "42.5-45.5"
    const range = parseRange(correctAns);
    if (range) {
      const val = Number(studentAns);
      if (!Number.isFinite(val)) {
        return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: neg ? -Math.abs(neg) : 0 };
      }
      const ok = val >= range.min && val <= range.max;
      return {
        isCorrect: ok,
        correctAnswerRaw: q?.correctAnswer ?? null,
        marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
      };
    }
    // Exact string match (case-insensitive)
    const ok = studentAns === correctAns;
    return {
      isCorrect: ok,
      correctAnswerRaw: q?.correctAnswer ?? null,
      marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
    };
  }
  // if (qt === 'matrix') {
  //   const studentMap = parseMatrixAnswer(String(answerRaw || ''));
  //   const correctMap = parseMatrixCorrect(String(q?.correctAnswer || ''));
  //   if (!correctMap.size || !studentMap.size) {
  //     return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: neg ? -Math.abs(neg) : 0 };
  //   }
  //   let correctPairs = 0;
  //   let totalPairs = 0;
  //   let earnedMarks = 0;
  //   for (const [lKey, correctEntries] of correctMap.entries()) {
  //     const studentRightKeys = studentMap.get(lKey) || [];
  //     const correctRightValues = new Set(correctEntries.map((e) => e.value));
  //     const { marks: pairMarks, negMark: pairNegMark } = correctEntries[0] || { marks: 0, negMark: 0 };
  //     for (const { value, marks, negMark } of correctEntries) {
  //       totalPairs++;
  //       if (studentRightKeys.includes(value)) {
  //         correctPairs++;
  //         earnedMarks += marks;
  //       }
  //     }
  //     if (studentRightKeys.length > 0) {
  //       for (const selectedKey of studentRightKeys) {
  //         if (!correctRightValues.has(selectedKey)) {
  //           earnedMarks -= Math.abs(pairNegMark || 0);
  //         }
  //       }
  //     }
  //   }
  //   earnedMarks = Math.max(earnedMarks, neg ? -Math.abs(neg) : 0);
  //   if (correctPairs === totalPairs) {
  //     return { isCorrect: true, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: pos };
  //   }
  //   if (correctPairs === 0) {
  //     return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: Math.min(earnedMarks, 0) };
  //   }
  //   if (q?.hasPartialMarking && earnedMarks > 0) {
  //     return { isCorrect: null, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: earnedMarks };
  //   }
  //   if (q?.hasPartialMarking && earnedMarks <= 0) {
  //     return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: earnedMarks };
  //   }
  //   return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: neg ? -Math.abs(neg) : 0 };
  // }
  if (qt === 'matrix') {
    const studentMap = parseMatrixAnswer(String(answerRaw || ''));
    const correctMap = parseMatrixCorrect(String(q?.correctAnswer || ''));
    if (!correctMap.size || !studentMap.size) {
      return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: neg ? -Math.abs(neg) : 0 };
    }
    let totalLeftKeys = 0;
    let fullyCorrectLeftKeys = 0;
    let earnedMarks = 0;
    for (const [lKey, correctEntries] of correctMap.entries()) {
      totalLeftKeys++;
      const studentRightKeys = studentMap.get(lKey) || [];
      const correctRightValues = new Set(correctEntries.map((e) => e.value));
      const pairMarks = correctEntries[0]?.marks || 0;
      const pairNegMark = correctEntries[0]?.negMark || 0;
      if (studentRightKeys.length === 0) {
        continue;
      }
      const hasWrongSelection = studentRightKeys.some((k) => !correctRightValues.has(k));
      const allCorrectSelected = correctEntries.every((e) => studentRightKeys.includes(e.value));
      if (allCorrectSelected && !hasWrongSelection) {
        fullyCorrectLeftKeys++;
        earnedMarks += pairMarks;
      } else {
        earnedMarks -= Math.abs(pairNegMark);
      }
    }
    earnedMarks = Math.max(earnedMarks, neg ? -Math.abs(neg) : -Infinity);
    if (fullyCorrectLeftKeys === totalLeftKeys) {
      return { isCorrect: true, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: pos };
    }
    if (earnedMarks > 0) {
      return { isCorrect: null, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: earnedMarks };
    }
    if (fullyCorrectLeftKeys === 0) {
      return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: earnedMarks };
    }
    return { isCorrect: false, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: earnedMarks };
  }
  return { isCorrect: null, correctAnswerRaw: q?.correctAnswer ?? null, marksAwarded: 0 };
};

const buildSectionResults = (answers, sections, sectionTimings = {}) => {
  const secMap = new Map((sections || []).map((s) => [safeTrim(s.sectionId), s]));
  const sectionTotalMarksMap = new Map();
  for (const a of answers) {
    const sid = safeTrim(a.sectionId);
    sectionTotalMarksMap.set(sid, (sectionTotalMarksMap.get(sid) || 0) + toNum(a.positiveMarks));
  }
  const buckets = new Map();
  for (const [sid, sec] of secMap.entries()) {
    buckets.set(sid, {
      sectionId: sid,
      subjectId: sec.subjectId || null,
      totalQuestions: 0,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      partialCount: 0,
      skippedCount: 0,
      totalMarks: toNum(sec.totalMarks) || sectionTotalMarksMap.get(sid) || 0,
      obtainedMarks: 0,
      timeTaken: toNum(sectionTimings[sid])
    });
  }
  for (const a of answers) {
    const b = buckets.get(safeTrim(a.sectionId));
    if (!b) continue;
    b.totalQuestions++;
    if (a.isSkipped) {
      b.skippedCount++;
    } else {
      b.answeredCount++;
      if (a.isCorrect === true) b.correctCount++;
      else if (a.isCorrect === false) b.wrongCount++;
      else if (a.answerRaw !== null) b.partialCount++;
    }
    b.obtainedMarks += toNum(a.marksAwarded);
  }
  return Array.from(buckets.values());
};

const submitResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const examId = safeTrim(req.body?.examId);
    const centerId = safeTrim(req.body?.centerId) || null;
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : null;
    const startedAt = req.body?.startedAt ? toNum(req.body.startedAt) : null;
    const completedAt = req.body?.completedAt ? toNum(req.body.completedAt) : Date.now();
    const sectionTimings = req.body?.sectionTimings || {};
    if (!tenantId || !admissionNo || !examId) return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });
    const batchId = req.body?.batchId ? await resolveBatchId(tenantId, req.body.batchId) : null;
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    if (exam.startTime && now < exam.startTime) return res.status(403).json({ status: false, message: 'Exam has not started yet' });
    const isLate = !!(exam.endTime && completedAt > exam.endTime);
    const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!incomingAnswers.length) return res.status(400).json({ status: false, message: 'answers[] is required' });
    const questions = await MockExamQns.find({ tenantId, examId, isdeleted: false }, { _id: 0, questionId: 1, sectionId: 1, questionType: 1, positiveMarks: 1, negativeMarks: 1, questionOptions: 1, hasPartialMarking: 1, numericMin: 1, numericMax: 1, correctAnswer: 1 }).lean();
    const qById = new Map(questions.map((q) => [safeTrim(q.questionId), q]));
    const totalPossible = questions.reduce((s, q) => s + toNum(q.positiveMarks), 0);
    const evaluated = [];
    let obtainedMarks = 0;
    for (const a of incomingAnswers) {
      const qid = safeTrim(a?.questionId);
      const sid = safeTrim(a?.sectionId);
      if (!qid) continue;
      const q = qById.get(qid) || null;
      const isSkipped = a?.isSkipped === true;
      const answerRaw = isSkipped ? null : (a?.answerRaw ?? null);
      const pos = q ? toNum(q.positiveMarks) : toNum(a?.positiveMarks);
      const neg = q ? toNum(q.negativeMarks) : toNum(a?.negativeMarks);
      let isCorrect = null,
        correctAnswerRaw = null,
        marksAwarded = 0;
      if (q && !isSkipped) {
        const ev = evalAnswer(q, answerRaw);
        isCorrect = ev.isCorrect;
        correctAnswerRaw = ev.correctAnswerRaw ?? null;
        marksAwarded = ev.marksAwarded;
      }
      obtainedMarks += toNum(marksAwarded);
      evaluated.push({
        questionId: qid,
        sectionId: q ? safeTrim(q.sectionId) : sid,
        answerRaw,
        isCorrect,
        isSkipped,
        timeTaken: toNum(a.timeTaken, 0),
        positiveMarks: pos,
        negativeMarks: neg,
        marksAwarded,
        correctAnswerRaw,
        hasPartialMarking: q?.hasPartialMarking || false
      });
    }
    // const sectionResults = buildSectionResults(evaluated, exam.sections, sectionTimings);
    // const totalMarks = toNum(exam.totalMarks) || totalPossible;
    // const doc = await MockExamResult.create({
    //   tenantId,
    //   examId,
    //   admissionNo,
    //   studentId: safeTrim(req.body?.studentId) || null,
    //   batchId,
    //   centerId,
    //   classNo,
    //   startedAt,
    //   completedAt,
    //   timeTaken: startedAt ? Math.max(0, completedAt - startedAt) : 0,
    //   isLate,
    //   totalQuestions: evaluated.length,
    //   totalMarks,
    //   obtainedMarks,
    //   sectionResults,
    //   answers: evaluated,
    //   status: 'completed',
    //   isResultVisible: false,
    //   createdBy: safeTrim(req.body?.userId) || null,
    //   updatedBy: safeTrim(req.body?.userId) || null
    // });
    const sectionResults = buildSectionResults(evaluated, exam.sections, sectionTimings);
    const totalMarks = toNum(exam.totalMarks) || totalPossible;

    const totalCorrect = evaluated.filter((a) => a.isCorrect === true).length;
    const totalWrong = evaluated.filter((a) => a.isCorrect === false).length;
    const totalSkipped = evaluated.filter((a) => a.isSkipped === true).length;
    const totalPartial = evaluated.filter((a) => a.isCorrect === null && !a.isSkipped && a.answerRaw !== null).length;
    const totalAnswered = evaluated.filter((a) => !a.isSkipped).length;

    const doc = await MockExamResult.create({
      tenantId,
      examId,
      admissionNo,
      studentId: safeTrim(req.body?.studentId) || null,
      batchId,
      centerId,
      classNo,
      startedAt,
      completedAt,
      timeTaken: startedAt ? Math.max(0, completedAt - startedAt) : 0,
      isLate,
      totalQuestions: evaluated.length,
      totalMarks,
      obtainedMarks,
      correctCount: totalCorrect,
      wrongCount: totalWrong,
      skippedCount: totalSkipped,
      partialCount: totalPartial,
      answeredCount: totalAnswered,
      sectionResults,
      answers: evaluated,
      status: 'completed',
      isResultVisible: false,
      createdBy: safeTrim(req.body?.userId) || null,
      updatedBy: safeTrim(req.body?.userId) || null
    });
    if (batchId) {
      await MockExamBatchAssign.updateOne(
        { tenantId, examId, batchId, isdeleted: false },
        {
          $set: {
            'students.$[st].status': 'completed',
            'students.$[st].completedAt': completedAt,
            'students.$[st].startedAt': startedAt,
            'students.$[st].obtainedMarks': obtainedMarks,
            'students.$[st].isLate': isLate
          }
        },
        { arrayFilters: [{ 'st.admissionNo': admissionNo }] }
      );
    }
    return res.status(200).json({
      status: true,
      message: 'Result submitted successfully',
      data: { _id: doc._id, examId, admissionNo, obtainedMarks, totalMarks, isLate, sectionResults }
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Result already submitted for this student and exam' });
    return next(err);
  }
};

// Evaluates one student's answers the same way submitResult does and creates the MockExamResult
// doc with the given submissionMode. Used only by the offline entry/correction endpoints below.
const evaluateAndCreateOfflineResult = async ({ tenantId, examId, exam, admissionNo, studentId, batchId, centerId, classNo, startedAt, completedAt, answers: incomingAnswers, createdBy }) => {
  const isLate = !!(exam.endTime && completedAt > exam.endTime);
  const questions = await MockExamQns.find({ tenantId, examId, isdeleted: false }, { _id: 0, questionId: 1, sectionId: 1, questionType: 1, positiveMarks: 1, negativeMarks: 1, questionOptions: 1, hasPartialMarking: 1, numericMin: 1, numericMax: 1, correctAnswer: 1 }).lean();
  const qById = new Map(questions.map((q) => [safeTrim(q.questionId), q]));
  const totalPossible = questions.reduce((s, q) => s + toNum(q.positiveMarks), 0);
  const evaluated = [];
  let obtainedMarks = 0;
  for (const a of incomingAnswers) {
    const qid = safeTrim(a?.questionId);
    const sid = safeTrim(a?.sectionId);
    if (!qid) continue;
    const q = qById.get(qid) || null;
    const isSkipped = a?.isSkipped === true;
    const answerRaw = isSkipped ? null : (a?.answerRaw ?? null);
    const pos = q ? toNum(q.positiveMarks) : toNum(a?.positiveMarks);
    const neg = q ? toNum(q.negativeMarks) : toNum(a?.negativeMarks);
    let isCorrect = null,
      correctAnswerRaw = null,
      marksAwarded = 0;
    if (q && !isSkipped) {
      const ev = evalAnswer(q, answerRaw);
      isCorrect = ev.isCorrect;
      correctAnswerRaw = ev.correctAnswerRaw ?? null;
      marksAwarded = ev.marksAwarded;
    }
    obtainedMarks += toNum(marksAwarded);
    evaluated.push({
      questionId: qid,
      sectionId: q ? safeTrim(q.sectionId) : sid,
      answerRaw,
      isCorrect,
      isSkipped,
      timeTaken: toNum(a.timeTaken, 0),
      positiveMarks: pos,
      negativeMarks: neg,
      marksAwarded,
      correctAnswerRaw,
      hasPartialMarking: q?.hasPartialMarking || false
    });
  }
  const sectionResults = buildSectionResults(evaluated, exam.sections, {});
  const totalMarks = toNum(exam.totalMarks) || totalPossible;

  const totalCorrect = evaluated.filter((a) => a.isCorrect === true).length;
  const totalWrong = evaluated.filter((a) => a.isCorrect === false).length;
  const totalSkipped = evaluated.filter((a) => a.isSkipped === true).length;
  const totalPartial = evaluated.filter((a) => a.isCorrect === null && !a.isSkipped && a.answerRaw !== null).length;
  const totalAnswered = evaluated.filter((a) => !a.isSkipped).length;

  const doc = await MockExamResult.create({
    tenantId,
    examId,
    admissionNo,
    studentId: studentId || null,
    batchId,
    centerId,
    classNo,
    startedAt,
    completedAt,
    timeTaken: startedAt ? Math.max(0, completedAt - startedAt) : 0,
    isLate,
    totalQuestions: evaluated.length,
    totalMarks,
    obtainedMarks,
    correctCount: totalCorrect,
    wrongCount: totalWrong,
    skippedCount: totalSkipped,
    partialCount: totalPartial,
    answeredCount: totalAnswered,
    sectionResults,
    answers: evaluated,
    status: 'completed',
    isResultVisible: false,
    submissionMode: 'OFFLINE',
    createdBy: createdBy || null,
    updatedBy: createdBy || null
  });
  if (batchId) {
    await MockExamBatchAssign.updateOne(
      { tenantId, examId, batchId, isdeleted: false },
      {
        $set: {
          'students.$[st].status': 'completed',
          'students.$[st].completedAt': completedAt,
          'students.$[st].startedAt': startedAt,
          'students.$[st].obtainedMarks': obtainedMarks,
          'students.$[st].isLate': isLate
        }
      },
      { arrayFilters: [{ 'st.admissionNo': admissionNo }] }
    );
  }
  return { doc, obtainedMarks, totalMarks, isLate, sectionResults };
};

const submitOfflineResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = safeTrim(req.body?.userId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const examId = safeTrim(req.body?.examId);
    const centerId = safeTrim(req.body?.centerId) || null;
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : null;
    const completedAt = req.body?.completedAt ? toNum(req.body.completedAt) : Date.now();
    if (!tenantId || !admissionNo || !examId) return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });
    const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!incomingAnswers.length) return res.status(400).json({ status: false, message: 'answers[] is required' });
    const batchId = req.body?.batchId ? await resolveBatchId(tenantId, req.body.batchId) : null;
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const startedAt = req.body?.startedAt ? toNum(req.body.startedAt) : exam.startTime || completedAt;
    const existing = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false }, { _id: 1 }).lean();
    if (existing) {
      return res.status(409).json({ status: false, message: 'A result already exists for this student and exam. Use the correction endpoint to overwrite it.' });
    }
    const { doc, obtainedMarks, totalMarks, isLate, sectionResults } = await evaluateAndCreateOfflineResult({
      tenantId,
      examId,
      exam,
      admissionNo,
      studentId: safeTrim(req.body?.studentId) || null,
      batchId,
      centerId,
      classNo,
      startedAt,
      completedAt,
      answers: incomingAnswers,
      createdBy: userId || null
    });
    return res.status(200).json({
      status: true,
      message: 'Offline result recorded successfully',
      data: { _id: doc._id, examId, admissionNo, obtainedMarks, totalMarks, isLate, sectionResults }
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'A result already exists for this student and exam' });
    return next(err);
  }
};

const submitOfflineResultsBulk = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = safeTrim(req.body?.userId);
    const examId = safeTrim(req.body?.examId);
    const students = Array.isArray(req.body?.students) ? req.body.students : [];
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    if (!students.length) return res.status(400).json({ status: false, message: 'students[] is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });

    const admissionNos = students.map((s) => safeTrim(s?.admissionNo)).filter(Boolean);
    const existingResults = await MockExamResult.find({ tenantId, examId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1 }).lean();
    const existingSet = new Set(existingResults.map((r) => r.admissionNo));

    const report = { successCount: 0, failedCount: 0, errors: [] };
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const admissionNo = safeTrim(s?.admissionNo);
      if (!admissionNo) {
        report.failedCount++;
        report.errors.push({ row: i + 1, reason: 'admissionNo is required' });
        continue;
      }
      if (existingSet.has(admissionNo)) {
        report.failedCount++;
        report.errors.push({ row: i + 1, admissionNo, reason: 'A result already exists for this student and exam' });
        continue;
      }
      const answers = Array.isArray(s?.answers) ? s.answers : [];
      if (!answers.length) {
        report.failedCount++;
        report.errors.push({ row: i + 1, admissionNo, reason: 'answers[] is required' });
        continue;
      }
      const completedAt = s?.completedAt ? toNum(s.completedAt) : Date.now();
      const startedAt = s?.startedAt ? toNum(s.startedAt) : exam.startTime || completedAt;
      try {
        await evaluateAndCreateOfflineResult({
          tenantId,
          examId,
          exam,
          admissionNo,
          studentId: safeTrim(s?.studentId) || null,
          batchId: safeTrim(s?.batchId) || null,
          centerId: safeTrim(s?.centerId) || null,
          classNo: s?.classNo ? toNum(s.classNo) : null,
          startedAt,
          completedAt,
          answers,
          createdBy: userId || null
        });
        existingSet.add(admissionNo);
        report.successCount++;
      } catch (e) {
        report.failedCount++;
        report.errors.push({ row: i + 1, admissionNo, reason: e?.code === 11000 ? 'A result already exists for this student and exam' : e?.message || 'Failed to save' });
      }
    }
    return res.status(200).json({
      status: true,
      message: `Offline results processed. Success: ${report.successCount}, Failed: ${report.failedCount}`,
      data: report
    });
  } catch (err) {
    return next(err);
  }
};

const correctOfflineResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = safeTrim(req.body?.userId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !admissionNo || !examId) return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });
    const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!incomingAnswers.length) return res.status(400).json({ status: false, message: 'answers[] is required' });
    const existing = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false });
    if (!existing) return res.status(404).json({ status: false, message: 'No existing result found for this student and exam. Use the offline entry endpoint to create one.' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });

    const batchId = (req.body?.batchId ? await resolveBatchId(tenantId, req.body.batchId) : null) || existing.batchId || null;
    const centerId = safeTrim(req.body?.centerId) || existing.centerId || null;
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : existing.classNo;
    const completedAt = req.body?.completedAt ? toNum(req.body.completedAt) : existing.completedAt || Date.now();
    const startedAt = req.body?.startedAt ? toNum(req.body.startedAt) : existing.startedAt || exam.startTime || completedAt;

    // Soft-delete the old row first so the partial unique index (tenantId, examId, admissionNo, isdeleted:false)
    // doesn't block re-creating it, then re-run the same evaluation used for a fresh offline entry.
    existing.isdeleted = true;
    existing.updatedBy = userId || null;
    await existing.save();

    const { doc, obtainedMarks, totalMarks, isLate, sectionResults } = await evaluateAndCreateOfflineResult({
      tenantId,
      examId,
      exam,
      admissionNo,
      studentId: existing.studentId || null,
      batchId,
      centerId,
      classNo,
      startedAt,
      completedAt,
      answers: incomingAnswers,
      createdBy: userId || null
    });
    return res.status(200).json({
      status: true,
      message: 'Offline result corrected successfully',
      data: { _id: doc._id, examId, admissionNo, obtainedMarks, totalMarks, isLate, sectionResults }
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Could not overwrite — a result already exists, please retry' });
    return next(err);
  }
};

const getMyResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    if (!tenantId || !examId || !admissionNo) return res.status(400).json({ status: false, message: 'tenantId, examId, admissionNo are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { autoPublishAt: 1, resultPublishedAt: 1, status: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    // const autoPublishPassed = !exam.autoPublishAt || now >= exam.autoPublishAt;
    // if (exam.status !== 'result_published' || !autoPublishPassed) {
    //   return res.status(403).json({ status: false, message: 'Result has not been published yet', autoPublishAt: exam.autoPublishAt || null });
    // }
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Result has not been published yet',
        autoPublishAt: exam.autoPublishAt || null
      });
    }
    const result = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false }).lean();
    if (!result) return res.status(404).json({ status: false, message: 'Result not found' });
    if (!result.isResultVisible) return res.status(403).json({ status: false, message: 'Result not yet visible' });
    return res.status(200).json({ status: true, message: 'Result loaded', data: { ...result, exam } });
  } catch (err) {
    return next(err);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { status: 1, autoPublishAt: 1, resultPublishedAt: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    // const autoPublishPassed = !exam.autoPublishAt || now >= exam.autoPublishAt;
    // if (exam.status !== 'result_published' || !autoPublishPassed) {
    //   return res.status(403).json({ status: false, message: 'Leaderboard not yet available', autoPublishAt: exam.autoPublishAt || null });
    // }
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Leaderboard not yet available',
        autoPublishAt: exam.autoPublishAt || null
      });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const query = { tenantId, examId, isdeleted: false, isResultVisible: true };
    if (safeTrim(req.body?.batchId)) query.batchId = await resolveBatchId(tenantId, req.body.batchId);
    if (safeTrim(req.body?.centerId)) query.centerId = safeTrim(req.body.centerId);
    const [rows, count] = await Promise.all([
      MockExamResult.find(query, { admissionNo: 1, studentId: 1, batchId: 1, centerId: 1, obtainedMarks: 1, totalMarks: 1, percentile: 1, rank: 1, timeTaken: 1, isLate: 1, sectionResults: 1, completedAt: 1, correctCount: 1, wrongCount: 1, skippedCount: 1 })
        .sort({ rank: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MockExamResult.countDocuments(query)
    ]);

    const data = await populateStudentNames(tenantId, rows);

    return res.status(200).json({ status: true, message: 'Leaderboard loaded', data, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const listResultsByExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { tenantId, examId, isdeleted: false };
    if (safeTrim(req.body?.batchId)) query.batchId = await resolveBatchId(tenantId, req.body.batchId);
    if (safeTrim(req.body?.centerId)) query.centerId = safeTrim(req.body.centerId);
    if (safeTrim(req.body?.admissionNo)) query.admissionNo = safeTrim(req.body.admissionNo);
    if (safeTrim(req.body?.status)) query.status = safeTrim(req.body.status);

    const [rows, count] = await Promise.all([MockExamResult.find(query).sort({ rank: 1, completedAt: -1 }).skip(skip).limit(limit).lean(), MockExamResult.countDocuments(query)]);
    const data = await populateStudentNames(tenantId, rows);
    return res.status(200).json({ status: true, message: 'Results loaded', data, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const listResultsByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const rawBatchId = safeTrim(req.body?.batchId);
    if (!tenantId || !rawBatchId) return res.status(400).json({ status: false, message: 'tenantId and batchId are required' });
    const batchId = await resolveBatchId(tenantId, rawBatchId);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { tenantId, batchId, isdeleted: false };
    if (safeTrim(req.body?.examId)) query.examId = safeTrim(req.body.examId);
    if (safeTrim(req.body?.admissionNo)) query.admissionNo = safeTrim(req.body.admissionNo);

    const [rows, count] = await Promise.all([MockExamResult.find(query).sort({ completedAt: -1 }).skip(skip).limit(limit).lean(), MockExamResult.countDocuments(query)]);
    const data = await populateStudentNames(tenantId, rows);
    return res.status(200).json({ status: true, message: 'Batch results loaded', data, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const listResultsByStudent = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    if (!tenantId || !admissionNo) return res.status(400).json({ status: false, message: 'tenantId and admissionNo are required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { tenantId, admissionNo, isdeleted: false };
    if (safeTrim(req.body?.examId)) query.examId = safeTrim(req.body.examId);
    if (safeTrim(req.body?.batchId)) query.batchId = await resolveBatchId(tenantId, req.body.batchId);

    const [rows, count] = await Promise.all([MockExamResult.find(query, { answers: 0 }).sort({ completedAt: -1 }).skip(skip).limit(limit).lean(), MockExamResult.countDocuments(query)]);
    const data = await populateStudentNames(tenantId, rows);
    return res.status(200).json({ status: true, message: 'Student results loaded', data, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const getSectionAnalytics = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { sections: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const matchQ = { tenantId, examId, isdeleted: false, isResultVisible: true };
    if (safeTrim(req.body?.batchId)) matchQ.batchId = await resolveBatchId(tenantId, req.body.batchId);
    if (safeTrim(req.body?.centerId)) matchQ.centerId = safeTrim(req.body.centerId);
    const agg = await MockExamResult.aggregate([
      { $match: matchQ },
      { $unwind: '$sectionResults' },
      {
        $group: {
          _id: '$sectionResults.sectionId',
          avgObtained: { $avg: '$sectionResults.obtainedMarks' },
          maxObtained: { $max: '$sectionResults.obtainedMarks' },
          minObtained: { $min: '$sectionResults.obtainedMarks' },
          avgTimeTaken: { $avg: '$sectionResults.timeTaken' },
          totalAttempts: { $sum: 1 },
          totalCorrect: { $sum: '$sectionResults.correctCount' },
          totalWrong: { $sum: '$sectionResults.wrongCount' },
          totalSkipped: { $sum: '$sectionResults.skippedCount' }
        }
      }
    ]);
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    const data = agg.map((r) => {
      const sec = secMap.get(safeTrim(r._id)) || {};
      const attempted = r.totalCorrect + r.totalWrong;
      return {
        sectionId: r._id,
        sectionName: sec.sectionName || r._id,
        sectionCode: sec.sectionCode || null,
        avgObtained: round2(r.avgObtained),
        maxObtained: round2(r.maxObtained),
        minObtained: round2(r.minObtained),
        avgTimeTakenMs: Math.round(r.avgTimeTaken || 0),
        totalAttempts: r.totalAttempts,
        totalCorrect: r.totalCorrect,
        totalWrong: r.totalWrong,
        totalSkipped: r.totalSkipped,
        accuracy: attempted > 0 ? round2((r.totalCorrect / attempted) * 100) : 0
      };
    });
    return res.status(200).json({ status: true, message: 'Section analytics loaded', data });
  } catch (err) {
    return next(err);
  }
};

// const getMyResultWithAnswers = async (req, res, next) => {
//   try {
//     const tenantId = pickTid(req);
//     const admissionNo = safeTrim(req.body?.admissionNo);
//     const examId = safeTrim(req.body?.examId);
//     if (!tenantId || !admissionNo || !examId) return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });
//     const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { status: 1, autoPublishAt: 1, resultPublishedAt: 1 }).lean();
//     if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
//     const now = Date.now();
//     const manuallyPublished = !!exam.resultPublishedAt;
//     const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
//     const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
//     if (!resultReady) {
//       return res.status(403).json({
//         status: false,
//         message: 'Result not published yet',
//         autoPublishAt: exam.autoPublishAt || null
//       });
//     }
//     const result = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false }).populate('sectionResults.subjectId', 'subjectName').lean();
//     if (!result) return res.status(404).json({ status: false, message: 'Result not found for this student' });
//     const studentProfile = await StudentProfile.findOne(
//       {
//         tenantId,
//         $or: [{ studentId: result.studentId }, { admissionNo: result.admissionNo }]
//       },
//       { 'student.name': 1 }
//     ).lean();
//     result.studentName = studentProfile?.student?.name || 'Unknown';
//     if (!result.isResultVisible) return res.status(403).json({ status: false, message: 'Result is not visible yet' });
//     const questions = await MockExamQns.find(
//       { tenantId, examId, isdeleted: false },
//       {
//         questionId: 1,
//         sectionId: 1,
//         questionType: 1,
//         difficulty: 1,
//         questionHtml: 1,
//         questionOptions: 1,
//         correctAnswer: 1,
//         solutionHtml: 1,
//         enableSolution: 1,
//         positiveMarks: 1,
//         negativeMarks: 1,
//         hasPartialMarking: 1,
//         numericMin: 1,
//         numericMax: 1,
//         passageId: 1,
//         passageHtml: 1,
//         topicId: 1,
//         subTopicId: 1,
//         tags: 1,
//         sortOrder: 1,
//         leftColumn: 1,
//         rightColumn: 1
//       }
//     )
//       .sort({ sectionId: 1, sortOrder: 1 })
//       .populate('passageId', 'title passageHtml')
//       .lean();
//     const qMap = new Map(questions.map((q) => [safeTrim(q.questionId), q]));
//     const answers = (result.answers || []).map((a) => {
//       const q = qMap.get(safeTrim(a.questionId)) || null;
//       return {
//         questionId: a.questionId,
//         sectionId: a.sectionId,
//         answerRaw: a.answerRaw,
//         correctAnswer: q ? (buildCorrectAnswer(q) ?? q.correctAnswer ?? null) : null,
//         isCorrect: a.isCorrect,
//         isSkipped: a.isSkipped,
//         marksAwarded: a.marksAwarded,
//         timeTaken: a.timeTaken || 0,
//         positiveMarks: a.positiveMarks,
//         negativeMarks: a.negativeMarks,
//         hasPartialMarking: a.hasPartialMarking,
//         questionType: q?.questionType || null,
//         difficulty: q?.difficulty || null,
//         questionHtml: q?.questionHtml || null,
//         questionOptions: q?.questionOptions || [],
//         solutionHtml: q?.enableSolution || !!q?.solutionHtml ? q?.solutionHtml || null : null,
//         numericMin: q?.numericMin ?? null,
//         numericMax: q?.numericMax ?? null,
//         topicId: q?.topicId || null,
//         subTopicId: q?.subTopicId || null,
//         leftColumn: q?.leftColumn || [],
//         rightColumn: q?.rightColumn || [],
//         tags: q?.tags || [],
//         sortOrder: q?.sortOrder ?? null,
//         passage: q?.passageId ? { title: q.passageId?.title || null, passageHtml: q.passageId?.passageHtml || null } : q?.passageHtml ? { title: null, passageHtml: q.passageHtml } : null
//       };
//     });
//     return res.status(200).json({
//       status: true,
//       message: 'Result with answers loaded',
//       data: {
//         examId,
//         admissionNo,
//         obtainedMarks: result.obtainedMarks,
//         totalMarks: result.totalMarks,
//         rank: result.rank,
//         percentile: result.percentile,
//         timeTaken: result.timeTaken,
//         isLate: result.isLate,
//         sectionResults: result.sectionResults,
//         graceLogs: result.graceLogs,
//         answers
//       }
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const getMyResultWithAnswers = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !admissionNo || !examId) return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });

    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { status: 1, autoPublishAt: 1, resultPublishedAt: 1, examName: 1, examCode: 1, totalMarks: 1, totalQuestions: 1, sections: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });

    const now = Date.now();
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Result not published yet',
        autoPublishAt: exam.autoPublishAt || null
      });
    }

    const result = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false }).populate('sectionResults.subjectId', 'subjectName').lean();
    if (!result) return res.status(404).json({ status: false, message: 'Result not found for this student' });
    if (!result.isResultVisible) return res.status(403).json({ status: false, message: 'Result is not visible yet' });

    // Fetch student name
    const studentProfile = await StudentProfile.findOne(
      {
        tenantId,
        $or: [{ studentId: result.studentId }, { admissionNo: result.admissionNo }]
      },
      { 'student.name': 1 }
    ).lean();
    const studentName = studentProfile?.student?.name || 'Unknown';

    // Fetch all questions with all required fields
    const questions = await MockExamQns.find(
      { tenantId, examId, isdeleted: false },
      {
        questionId: 1,
        questionNo: 1,
        sectionId: 1,
        questionType: 1,
        difficulty: 1,
        questionHtml: 1,
        questionOptions: 1,
        correctAnswer: 1,
        solutionHtml: 1,
        enableSolution: 1,
        instructionHtml: 1,
        enableInstruction: 1,
        passageHtml: 1,
        passageId: 1,
        enablePassage: 1,
        positiveMarks: 1,
        negativeMarks: 1,
        hasPartialMarking: 1,
        numericMin: 1,
        numericMax: 1,
        leftColumn: 1,
        rightColumn: 1,
        topicId: 1,
        subTopicId: 1,
        tags: 1,
        sortOrder: 1
      }
    )
      .sort({ sectionId: 1, sortOrder: 1 })
      .populate('passageId', 'title passageHtml language')
      .lean();

    const qMap = new Map(questions.map((q) => [safeTrim(q.questionId), q]));

    const answers = (result.answers || []).map((a) => {
      const q = qMap.get(safeTrim(a.questionId)) || null;

      // Resolve passage
      const passage = q?.passageId
        ? {
            title: q.passageId?.title || null,
            passageHtml: q.passageId?.passageHtml || null,
            language: q.passageId?.language || null
          }
        : q?.enablePassage && q?.passageHtml
          ? { title: null, passageHtml: q.passageHtml, language: null }
          : null;

      return {
        questionId: a.questionId,
        questionNo: q?.questionNo || null,
        sectionId: a.sectionId,
        answerRaw: a.answerRaw,
        correctAnswer: q ? (buildCorrectAnswer(q) ?? q.correctAnswer ?? null) : null,
        isCorrect: a.isCorrect,
        isSkipped: a.isSkipped,
        marksAwarded: a.marksAwarded,
        timeTaken: a.timeTaken || 0,
        positiveMarks: a.positiveMarks,
        negativeMarks: a.negativeMarks,
        hasPartialMarking: a.hasPartialMarking,
        // Question details
        questionType: q?.questionType || null,
        difficulty: q?.difficulty || null,
        questionHtml: q?.questionHtml || null,
        questionOptions: q?.questionOptions || [],
        // Solution — only if enabled
        solutionHtml: q?.enableSolution ? q?.solutionHtml || null : null,
        // Instruction — only if enabled
        instructionHtml: q?.enableInstruction ? q?.instructionHtml || null : null,
        // Passage
        passage,
        // Numeric
        numericMin: q?.numericMin ?? null,
        numericMax: q?.numericMax ?? null,
        // Matrix
        leftColumn: q?.leftColumn || [],
        rightColumn: q?.rightColumn || [],
        // Meta
        topicId: q?.topicId || null,
        subTopicId: q?.subTopicId || null,
        tags: q?.tags || [],
        sortOrder: q?.sortOrder ?? null
      };
    });

    return res.status(200).json({
      status: true,
      message: 'Result with answers loaded',
      data: {
        examId,
        admissionNo,
        studentName,
        obtainedMarks: result.obtainedMarks,
        totalMarks: result.totalMarks,
        totalQuestions: result.totalQuestions,
        rank: result.rank,
        percentile: result.percentile,
        timeTaken: result.timeTaken,
        isLate: result.isLate,
        correctCount: result.correctCount ?? null,
        wrongCount: result.wrongCount ?? null,
        skippedCount: result.skippedCount ?? null,
        partialCount: result.partialCount ?? null,
        answeredCount: result.answeredCount ?? null,
        status: result.status,
        isResultVisible: result.isResultVisible,
        sectionResults: result.sectionResults,
        graceLogs: result.graceLogs || [],
        publishHistory: result.publishHistory || [],
        exam: {
          examId: exam.examId,
          examName: exam.examName,
          examCode: exam.examCode,
          totalMarks: exam.totalMarks,
          totalQuestions: exam.totalQuestions,
          sections: exam.sections || [],
          status: exam.status,
          resultPublishedAt: exam.resultPublishedAt || null,
          autoPublishAt: exam.autoPublishAt || null
        },
        answers
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getQuestionTimingAnalytics = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = req.body?.batchId ? await resolveBatchId(tenantId, req.body.batchId) : null;
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const matchStage = { tenantId, examId, isdeleted: false };
    if (batchId) matchStage.batchId = batchId;
    const rows = await MockExamResult.aggregate([
      { $match: matchStage },
      { $unwind: '$answers' },
      {
        $group: {
          _id: '$answers.questionId',
          sectionId: { $first: '$answers.sectionId' },
          avgTimeTaken: { $avg: '$answers.timeTaken' },
          minTimeTaken: { $min: '$answers.timeTaken' },
          maxTimeTaken: { $max: '$answers.timeTaken' },
          totalStudents: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          questionId: '$_id',
          sectionId: 1,
          avgTimeTaken: { $round: ['$avgTimeTaken', 0] },
          minTimeTaken: 1,
          maxTimeTaken: 1,
          totalStudents: 1
        }
      },
      { $sort: { sectionId: 1, questionId: 1 } }
    ]);
    return res.status(200).json({
      status: true,
      message: 'Question timing analytics loaded',
      examId,
      batchId: batchId || null,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const getQuestionAttemptAnalytics = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = req.body?.batchId ? await resolveBatchId(tenantId, req.body.batchId) : null;
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const matchStage = { tenantId, examId, isdeleted: false };
    if (batchId) matchStage.batchId = batchId;
    const rows = await MockExamResult.aggregate([
      { $match: matchStage },
      { $unwind: '$answers' },
      {
        $group: {
          _id: '$answers.questionId',
          sectionId: { $first: '$answers.sectionId' },
          totalStudents: { $sum: 1 },
          correctCount: {
            $sum: { $cond: [{ $eq: ['$answers.isCorrect', true] }, 1, 0] }
          },
          wrongCount: {
            $sum: { $cond: [{ $eq: ['$answers.isCorrect', false] }, 1, 0] }
          },
          skippedCount: {
            $sum: { $cond: [{ $eq: ['$answers.isSkipped', true] }, 1, 0] }
          },
          avgMarksAwarded: { $avg: '$answers.marksAwarded' }
        }
      },
      {
        $project: {
          _id: 0,
          questionId: '$_id',
          sectionId: 1,
          totalStudents: 1,
          correctCount: 1,
          wrongCount: 1,
          skippedCount: 1,
          avgMarksAwarded: { $round: ['$avgMarksAwarded', 2] },
          accuracyPct: {
            $round: [
              {
                $cond: [{ $gt: ['$totalStudents', 0] }, { $multiply: [{ $divide: ['$correctCount', '$totalStudents'] }, 100] }, 0]
              },
              2
            ]
          }
        }
      },
      { $sort: { sectionId: 1, questionId: 1 } }
    ]);
    return res.status(200).json({
      status: true,
      message: 'Question attempt analytics loaded',
      examId,
      batchId: batchId || null,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchAttendanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const rawBatchId = safeTrim(req.body?.batchId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!rawBatchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const batchId = await resolveBatchId(tenantId, rawBatchId);
    const assign = await MockExamBatchAssign.findOne({ tenantId, examId, batchId, isdeleted: false }).lean();
    if (!assign) {
      return res.status(404).json({ status: false, message: 'No assignment found for this exam and batch' });
    }
    const students = Array.isArray(assign.students) ? assign.students : [];
    const admissionNos = students.map((s) => safeTrim(s.admissionNo)).filter(Boolean);
    const results = await MockExamResult.find({ tenantId, examId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, isLate: 1, completedAt: 1, sectionResults: 1 }).lean();
    const resultMap = new Map(results.map((r) => [r.admissionNo, r]));
    const profiles = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, 'student.name': 1, 'student.phone': 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));
    let totalAssigned = 0;
    let completedCount = 0;
    let startedCount = 0;
    let absentCount = 0;
    let notStartedCount = 0;
    const attendedRows = [];
    const notAttendedRows = [];
    for (const s of students) {
      const admNo = safeTrim(s.admissionNo);
      const profile = profileMap.get(admNo) || null;
      const result = resultMap.get(admNo) || null;
      totalAssigned++;
      const row = {
        admissionNo: admNo,
        studentName: profile?.student?.name || null,
        studentPhone: profile?.student?.phone || null,
        assignStatus: s.status,
        assignedAt: s.assignedAt || null,
        startedAt: result?.completedAt ? s.startedAt || null : null,
        completedAt: s.completedAt || null,
        obtainedMarks: result?.obtainedMarks ?? null,
        totalMarks: result?.totalMarks ?? null,
        rank: result?.rank ?? null,
        percentile: result?.percentile ?? null,
        timeTaken: result?.timeTaken ?? null,
        isLate: result?.isLate ?? false
      };
      if (s.status === 'completed') {
        completedCount++;
        attendedRows.push({ ...row, attendanceStatus: 'completed' });
      } else if (s.status === 'started') {
        startedCount++;
        attendedRows.push({ ...row, attendanceStatus: 'started' });
      } else if (s.status === 'absent') {
        absentCount++;
        notAttendedRows.push({ ...row, attendanceStatus: 'absent' });
      } else {
        notStartedCount++;
        notAttendedRows.push({ ...row, attendanceStatus: 'not_started' });
      }
    }
    attendedRows.sort((a, b) => (a.rank ?? 99999) - (b.rank ?? 99999));
    const attendedCount = completedCount + startedCount;
    const notAttendedCount = absentCount + notStartedCount;
    const attendancePct = totalAssigned > 0 ? round2((attendedCount / totalAssigned) * 100) : 0;
    return res.status(200).json({
      status: true,
      message: 'Batch attendance report loaded',
      data: {
        examId,
        batchId,
        summary: {
          totalAssigned,
          attendedCount,
          notAttendedCount,
          completedCount,
          startedCount,
          absentCount,
          notStartedCount,
          attendancePct
        },
        attended: attendedRows,
        notAttended: notAttendedRows
      }
    });
  } catch (err) {
    return next(err);
  }
};

// Downloadable list of students who were assigned to this exam (via enabled batches) but never
// actually completed it. Only becomes available once the exam window has closed or results are
// published — before that, "didn't attend yet" and "hasn't started yet" aren't distinguishable.
//
// batchId omitted -> covers every batch currently enabled for this exam, not just one.
//
// Note: nothing in this codebase ever flips a MockExamBatchAssign student's status to 'absent' —
// a no-show simply stays at the schema default ('assigned') forever. So "didn't attend" is computed
// here as "assigned, but no completed MockExamResult exists" — the same defensive cross-check
// getStudentStatus() already uses — rather than trusting that status field literally.
const getExamAbsenteesReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = req.body?.batchId ? await resolveBatchId(tenantId, req.body.batchId) : '';
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });

    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { status: 1, endTime: 1, examName: 1, examCode: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });

    const windowClosed = !!exam.endTime && Date.now() >= exam.endTime;
    const resultPublished = exam.status === 'result_published';
    if (!windowClosed && !resultPublished) {
      return res.status(400).json({
        status: false,
        message: 'Absentees report is available only after the exam window has closed or results are published'
      });
    }

    const assignQuery = { tenantId, examId, isdeleted: false, status: 'enabled' };
    if (batchId) assignQuery.batchId = batchId;
    const assignments = await MockExamBatchAssign.find(assignQuery, { batchId: 1, centerId: 1, students: 1 }).lean();
    if (batchId && !assignments.length) {
      return res.status(404).json({ status: false, message: 'No assignment found for this exam and batch' });
    }
    if (!assignments.length) {
      return res.status(200).json({ status: true, message: 'Absentees report loaded', data: { examId, examName: exam.examName, summary: { totalAssigned: 0, absentCount: 0 }, batches: [] } });
    }

    const batchIds = assignments.map((a) => a.batchId);
    const assignedAdmissionNos = assignments.flatMap((a) => (Array.isArray(a.students) ? a.students : []).map((s) => safeTrim(s.admissionNo)));
    const [results, batches] = await Promise.all([
      MockExamResult.find({ tenantId, examId, admissionNo: { $in: assignedAdmissionNos }, isdeleted: false }, { admissionNo: 1, completedAt: 1, status: 1 }).lean(),
      Batch.find({ tenantId, batchId: { $in: batchIds }, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1 }).lean()
    ]);
    const completedAdmissionNos = new Set(results.filter((r) => r.completedAt || ['completed', 'evaluated', 'result_published'].includes(r.status)).map((r) => safeTrim(r.admissionNo)));
    const batchMap = new Map(batches.map((b) => [b.batchId, b]));

    const allAbsentAdmissionNos = [];
    const batchGroups = assignments.map((a) => {
      const students = Array.isArray(a.students) ? a.students : [];
      const absentees = students.filter((s) => !completedAdmissionNos.has(safeTrim(s.admissionNo)));
      absentees.forEach((s) => allAbsentAdmissionNos.push(safeTrim(s.admissionNo)));
      return { batchId: a.batchId, students, absentees };
    });

    const profiles = allAbsentAdmissionNos.length
      ? await StudentProfile.find({ tenantId, admissionNo: { $in: allAbsentAdmissionNos }, isdeleted: false }, { admissionNo: 1, 'student.name': 1, 'student.phone': 1 }).lean()
      : [];
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));

    let totalAssigned = 0;
    let absentCount = 0;
    const batchOut = batchGroups.map((g) => {
      const batchMeta = batchMap.get(g.batchId) || {};
      totalAssigned += g.students.length;
      absentCount += g.absentees.length;
      return {
        batchId: g.batchId,
        batchCode: batchMeta.batchCode || null,
        batchName: batchMeta.batchName || null,
        totalAssigned: g.students.length,
        absentCount: g.absentees.length,
        absentees: g.absentees.map((s) => {
          const profile = profileMap.get(safeTrim(s.admissionNo)) || null;
          return {
            admissionNo: safeTrim(s.admissionNo),
            studentName: profile?.student?.name || null,
            studentPhone: profile?.student?.phone || null,
            assignedAt: s.assignedAt || null,
            assignStatus: s.status
          };
        })
      };
    });

    return res.status(200).json({
      status: true,
      message: 'Absentees report loaded',
      data: {
        examId,
        examName: exam.examName,
        examCode: exam.examCode,
        summary: { totalAssigned, absentCount, attendancePct: totalAssigned > 0 ? round2(((totalAssigned - absentCount) / totalAssigned) * 100) : 0 },
        batches: batchOut
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchPerformanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const rawBatchId = safeTrim(req.body?.batchId);
    const rangeSize = toNum(req.body?.rangeSize) || 50;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!rawBatchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const batchId = await resolveBatchId(tenantId, rawBatchId);
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { totalMarks: 1, sections: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const results = await MockExamResult.find({ tenantId, examId, batchId, isdeleted: false, isResultVisible: true }, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, sectionResults: 1 }).lean();
    if (!results.length) {
      return res.status(200).json({
        status: true,
        message: 'No published results found for this batch',
        data: { examId, batchId, summary: null, scoreDistribution: [], sectionWise: [], topper: null }
      });
    }
    const totalMarks = toNum(exam.totalMarks) || 1;
    const scores = results.map((r) => toNum(r.obtainedMarks));
    const totalStudents = results.length;
    const avgScore = round2(scores.reduce((s, m) => s + m, 0) / totalStudents);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const passCount = scores.filter((s) => s >= totalMarks * 0.35).length;
    const avgPct = round2((avgScore / totalMarks) * 100);
    const buckets = new Map();
    const bucketCount = Math.ceil(totalMarks / rangeSize);
    for (let i = 0; i < bucketCount; i++) {
      const from = i * rangeSize;
      const to = Math.min((i + 1) * rangeSize - 1, totalMarks);
      const label = `${from}-${to}`;
      buckets.set(label, { range: label, from, to, count: 0, pct: 0 });
    }
    for (const score of scores) {
      const bucketIdx = Math.floor(score / rangeSize);
      const from = bucketIdx * rangeSize;
      const to = Math.min((bucketIdx + 1) * rangeSize - 1, totalMarks);
      const label = `${from}-${to}`;
      if (buckets.has(label)) {
        buckets.get(label).count++;
      }
    }
    const scoreDistribution = Array.from(buckets.values()).map((b) => ({
      ...b,
      pct: round2((b.count / totalStudents) * 100)
    }));
    const secBuckets = new Map();
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    for (const r of results) {
      for (const sec of r.sectionResults || []) {
        const sid = safeTrim(sec.sectionId);
        if (!secBuckets.has(sid)) {
          const secMeta = secMap.get(sid) || {};
          secBuckets.set(sid, {
            sectionId: sid,
            sectionName: secMeta.sectionName || sid,
            sectionCode: secMeta.sectionCode || null,
            totalStudents: 0,
            totalObtained: 0,
            maxObtained: 0,
            minObtained: Infinity,
            totalCorrect: 0,
            totalWrong: 0,
            totalSkipped: 0
          });
        }
        const b = secBuckets.get(sid);
        b.totalStudents++;
        b.totalObtained += toNum(sec.obtainedMarks);
        b.maxObtained = Math.max(b.maxObtained, toNum(sec.obtainedMarks));
        b.minObtained = Math.min(b.minObtained, toNum(sec.obtainedMarks));
        b.totalCorrect += toNum(sec.correctCount);
        b.totalWrong += toNum(sec.wrongCount);
        b.totalSkipped += toNum(sec.skippedCount);
      }
    }

    const sectionWise = Array.from(secBuckets.values()).map((b) => ({
      sectionId: b.sectionId,
      sectionName: b.sectionName,
      sectionCode: b.sectionCode,
      avgMarks: round2(b.totalObtained / b.totalStudents),
      maxMarks: round2(b.maxObtained),
      minMarks: b.minObtained === Infinity ? 0 : round2(b.minObtained),
      totalCorrect: b.totalCorrect,
      totalWrong: b.totalWrong,
      totalSkipped: b.totalSkipped,
      accuracy: b.totalCorrect + b.totalWrong > 0 ? round2((b.totalCorrect / (b.totalCorrect + b.totalWrong)) * 100) : 0
    }));
    const topperResult = results.reduce((best, r) => (toNum(r.obtainedMarks) > toNum(best.obtainedMarks) ? r : best), results[0]);
    const topperProfile = await StudentProfile.findOne({ tenantId, admissionNo: topperResult.admissionNo, isdeleted: false }, { admissionNo: 1, 'student.name': 1 }).lean();
    const topper = {
      admissionNo: topperResult.admissionNo,
      studentName: topperProfile?.student?.name || null,
      obtainedMarks: toNum(topperResult.obtainedMarks),
      totalMarks: toNum(topperResult.totalMarks),
      rank: topperResult.rank,
      percentile: topperResult.percentile,
      sectionResults: topperResult.sectionResults || []
    };
    return res.status(200).json({
      status: true,
      message: 'Batch performance report loaded',
      data: {
        examId,
        batchId,
        totalMarks,
        summary: {
          totalStudents,
          avgScore,
          maxScore,
          minScore,
          passCount,
          failCount: totalStudents - passCount,
          passPct: round2((passCount / totalStudents) * 100),
          avgPct
        },
        scoreDistribution,
        sectionWise,
        topper
      }
    });
  } catch (err) {
    return next(err);
  }
};

const compareWithTopper = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const batchId = req.body?.batchId ? await resolveBatchId(tenantId, req.body.batchId) : null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!admissionNo) return res.status(400).json({ status: false, message: 'admissionNo is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { totalMarks: 1, sections: 1, status: 1, autoPublishAt: 1, resultPublishedAt: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Result has not been published yet'
      });
    }
    const studentResult = await MockExamResult.findOne(
      { tenantId, examId, admissionNo, isdeleted: false },
      { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, isLate: 1, sectionResults: 1, correctCount: 1, wrongCount: 1, skippedCount: 1, totalQuestions: 1 }
    ).lean();
    if (!studentResult) {
      return res.status(404).json({ status: false, message: 'Student result not found' });
    }
    const topperQuery = { tenantId, examId, isdeleted: false, isResultVisible: true, rank: 1 };
    if (batchId) topperQuery.batchId = batchId;
    const topperResult = await MockExamResult.findOne(topperQuery, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, sectionResults: 1, correctCount: 1, wrongCount: 1, skippedCount: 1, totalQuestions: 1 }).lean();
    if (!topperResult) {
      return res.status(404).json({ status: false, message: 'Topper result not found' });
    }
    const [studentProfile, topperProfile] = await Promise.all([
      StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false }, { admissionNo: 1, 'student.name': 1 }).lean(),
      StudentProfile.findOne({ tenantId, admissionNo: topperResult.admissionNo, isdeleted: false }, { admissionNo: 1, 'student.name': 1 }).lean()
    ]);
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    const topperSecMap = new Map((topperResult.sectionResults || []).map((s) => [safeTrim(s.sectionId), s]));
    const sectionComparison = (studentResult.sectionResults || []).map((sec) => {
      const sid = safeTrim(sec.sectionId);
      const topperSec = topperSecMap.get(sid) || null;
      const secMeta = secMap.get(sid) || {};
      const studentMark = toNum(sec.obtainedMarks);
      const topperMark = toNum(topperSec?.obtainedMarks);
      const gap = round2(topperMark - studentMark);
      return {
        sectionId: sid,
        sectionName: secMeta.sectionName || sid,
        sectionCode: secMeta.sectionCode || null,
        // student: {
        //   obtainedMarks: studentMark,
        //   totalQuestions: toNum(sec.totalQuestions),
        //   correct: toNum(sec.correctCount),
        //   wrong: toNum(sec.wrongCount),
        //   skipped: toNum(sec.skippedCount),
        //   accuracy: toNum(sec.correctCount) + toNum(sec.wrongCount) > 0 ? round2((toNum(sec.correctCount) / (toNum(sec.correctCount) + toNum(sec.wrongCount))) * 100) : 0
        // },
        // topper: topperSec
        //   ? {
        //       obtainedMarks: topperMark,
        //       totalQuestions: toNum(topperSec.totalQuestions),
        //       correct: toNum(topperSec.correctCount),
        //       wrong: toNum(topperSec.wrongCount),
        //       skipped: toNum(topperSec.skippedCount),
        //       accuracy: toNum(topperSec.correctCount) + toNum(topperSec.wrongCount) > 0 ? round2((toNum(topperSec.correctCount) / (toNum(topperSec.correctCount) + toNum(topperSec.wrongCount))) * 100) : 0
        //     }
        //   : null,
        student: {
          obtainedMarks: studentMark,
          totalMarks: toNum(sec.totalMarks),
          totalQuestions: toNum(sec.totalQuestions),
          correct: toNum(sec.correctCount),
          wrong: toNum(sec.wrongCount),
          skipped: toNum(sec.skippedCount),
          partial: toNum(sec.partialCount),
          answered: toNum(sec.answeredCount),
          accuracy: toNum(sec.correctCount) + toNum(sec.wrongCount) > 0 ? round2((toNum(sec.correctCount) / (toNum(sec.correctCount) + toNum(sec.wrongCount))) * 100) : 0
        },
        topper: topperSec
          ? {
              obtainedMarks: topperMark,
              totalMarks: toNum(topperSec.totalMarks),
              totalQuestions: toNum(topperSec.totalQuestions),
              correct: toNum(topperSec.correctCount),
              wrong: toNum(topperSec.wrongCount),
              skipped: toNum(topperSec.skippedCount),
              partial: toNum(topperSec.partialCount),
              answered: toNum(topperSec.answeredCount),
              accuracy: toNum(topperSec.correctCount) + toNum(topperSec.wrongCount) > 0 ? round2((toNum(topperSec.correctCount) / (toNum(topperSec.correctCount) + toNum(topperSec.wrongCount))) * 100) : 0
            }
          : null,
        gap,
        isAhead: gap <= 0
      };
    });
    const totalMarks = toNum(exam.totalMarks) || 1;
    const studentScore = toNum(studentResult.obtainedMarks);
    const topperScore = toNum(topperResult.obtainedMarks);
    const overallGap = round2(topperScore - studentScore);
    const studentPct = round2((studentScore / totalMarks) * 100);
    const topperPct = round2((topperScore / totalMarks) * 100);
    return res.status(200).json({
      status: true,
      message: 'Comparison loaded',
      data: {
        examId,
        batchId: batchId || null,
        totalMarks,
        // student: {
        //   admissionNo: admissionNo,
        //   studentName: studentProfile?.student?.name || null,
        //   obtainedMarks: studentScore,
        //   totalMarks,
        //   scorePct: studentPct,
        //   rank: studentResult.rank,
        //   percentile: studentResult.percentile,
        //   timeTaken: studentResult.timeTaken,
        //   isLate: studentResult.isLate,
        //   totalQuestions: studentResult.totalQuestions,
        //   correct: studentResult.correctCount ?? sumFromSections(studentResult, 'correctCount'),
        //   wrong: studentResult.wrongCount ?? sumFromSections(studentResult, 'wrongCount'),
        //   skipped: studentResult.skippedCount ?? sumFromSections(studentResult, 'skippedCount')
        // },
        // topper: {
        //   admissionNo: topperResult.admissionNo,
        //   studentName: topperProfile?.student?.name || null,
        //   obtainedMarks: topperScore,
        //   totalMarks,
        //   scorePct: topperPct,
        //   rank: 1,
        //   percentile: topperResult.percentile,
        //   timeTaken: topperResult.timeTaken,
        //   totalQuestions: topperResult.totalQuestions,
        //   correct: topperResult.correctCount ?? sumFromSections(topperResult, 'correctCount'),
        //   wrong: topperResult.wrongCount ?? sumFromSections(topperResult, 'wrongCount'),
        //   skipped: topperResult.skippedCount ?? sumFromSections(topperResult, 'skippedCount')
        // },
        student: {
          admissionNo: admissionNo,
          studentName: studentProfile?.student?.name || null,
          obtainedMarks: studentScore,
          totalMarks,
          scorePct: studentPct,
          rank: studentResult.rank,
          percentile: studentResult.percentile,
          timeTaken: studentResult.timeTaken,
          isLate: studentResult.isLate,
          totalQuestions: studentResult.totalQuestions,
          correct: studentResult.correctCount ?? sumFromSections(studentResult, 'correctCount'),
          wrong: studentResult.wrongCount ?? sumFromSections(studentResult, 'wrongCount'),
          skipped: studentResult.skippedCount ?? sumFromSections(studentResult, 'skippedCount'),
          partial: studentResult.partialCount ?? sumFromSections(studentResult, 'partialCount'),
          answered: studentResult.answeredCount ?? sumFromSections(studentResult, 'answeredCount')
        },
        topper: {
          admissionNo: topperResult.admissionNo,
          studentName: topperProfile?.student?.name || null,
          obtainedMarks: topperScore,
          totalMarks,
          scorePct: topperPct,
          rank: 1,
          percentile: topperResult.percentile,
          timeTaken: topperResult.timeTaken,
          totalQuestions: topperResult.totalQuestions,
          correct: topperResult.correctCount ?? sumFromSections(topperResult, 'correctCount'),
          wrong: topperResult.wrongCount ?? sumFromSections(topperResult, 'wrongCount'),
          skipped: topperResult.skippedCount ?? sumFromSections(topperResult, 'skippedCount'),
          partial: topperResult.partialCount ?? sumFromSections(topperResult, 'partialCount'),
          answered: topperResult.answeredCount ?? sumFromSections(topperResult, 'answeredCount')
        },
        overall: {
          gap: overallGap,
          gapPct: round2(topperPct - studentPct),
          isAhead: overallGap <= 0,
          studentRank: studentResult.rank,
          topperRank: 1
        },
        sectionComparison
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getExamQuestionWiseReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const matchQ = { tenantId, examId, isdeleted: false };
    if (safeTrim(req.body?.batchId)) matchQ.batchId = await resolveBatchId(tenantId, req.body.batchId);
    if (safeTrim(req.body?.centerId)) matchQ.centerId = safeTrim(req.body.centerId);

    const [results, questions] = await Promise.all([MockExamResult.find(matchQ, { answers: 1 }).lean(), MockExamQns.find({ tenantId, examId, isdeleted: false }, { questionId: 1, sectionId: 1, sortOrder: 1 }).sort({ sectionId: 1, sortOrder: 1 }).lean()]);

    const totalParticipants = results.length;
    const statsMap = new Map();

    // Initialize map with all questions
    questions.forEach((q) => {
      statsMap.set(safeTrim(q.questionId), { correct: 0, incorrect: 0, skipped: 0, totalTime: 0, seenCount: 0 });
    });

    // Aggregate stats
    results.forEach((r) => {
      (r.answers || []).forEach((a) => {
        const qId = safeTrim(a.questionId);
        const s = statsMap.get(qId);
        if (s) {
          s.seenCount++;
          if (a.isSkipped) s.skipped++;
          else if (a.isCorrect === true) s.correct++;
          else s.incorrect++;
          s.totalTime += toNum(a.timeTaken);
        }
      });
    });

    const data = questions.map((q, idx) => {
      const qId = safeTrim(q.questionId);
      const s = statsMap.get(qId);
      return {
        qNo: idx + 1,
        questionId: qId,
        totalParticipants,
        correctedBy: s.correct,
        incorrectedBy: s.incorrect,
        unattemptedBy: s.skipped,
        unseenBy: totalParticipants - s.seenCount,
        avgTimeTaken: s.seenCount > 0 ? round2(s.totalTime / (s.seenCount * 1000)) : 0
      };
    });

    return res.status(200).json({ status: true, message: 'Question wise report loaded', data });
  } catch (err) {
    return next(err);
  }
};

// One row per student, one column per question — shaped for a direct Excel export (frontend maps
// `questions[]` to header columns and each row's `marks[]` to the matching column, in order).
const getQuestionWiseMarksExport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examName: 1, examCode: 1, startTime: 1, totalMarks: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });

    const matchQ = { tenantId, examId, isdeleted: false };
    if (safeTrim(req.body?.batchId)) matchQ.batchId = await resolveBatchId(tenantId, req.body.batchId);
    if (safeTrim(req.body?.centerId)) matchQ.centerId = safeTrim(req.body.centerId);

    const [questions, results] = await Promise.all([
      MockExamQns.find({ tenantId, examId, isdeleted: false }, { questionId: 1, sectionId: 1, sortOrder: 1 })
        .sort({ sectionId: 1, sortOrder: 1 })
        .lean(),
      MockExamResult.find(matchQ, { admissionNo: 1, studentId: 1, classNo: 1, batchId: 1, answers: 1 }).lean()
    ]);

    const questionCols = questions.map((q, idx) => ({ qNo: idx + 1, questionId: safeTrim(q.questionId), label: `Q${idx + 1} Marks` }));
    const qIndexById = new Map(questionCols.map((q, idx) => [q.questionId, idx]));

    const withNames = await populateStudentNames(tenantId, results);

    const admissionNos = results.map((r) => r.admissionNo).filter(Boolean);
    const profiles = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, classNo: 1, batchId: 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));

    // batchId on MockExamResult/StudentProfile has been observed holding a batchCode on some
    // records rather than the real batchId — match on either field defensively (see batch.helper.js).
    const batchKeys = [...new Set(withNames.map((r) => r.batchId || profileMap.get(safeTrim(r.admissionNo))?.batchId).filter(Boolean))];
    const batches = batchKeys.length ? await Batch.find({ tenantId, $or: [{ batchId: { $in: batchKeys } }, { batchCode: { $in: batchKeys } }] }, { batchId: 1, batchName: 1, batchCode: 1 }).lean() : [];
    const batchMap = new Map();
    for (const b of batches) {
      batchMap.set(b.batchId, b);
      batchMap.set(b.batchCode, b);
    }

    const data = withNames.map((r, idx) => {
      const profile = profileMap.get(safeTrim(r.admissionNo));
      const batchKey = r.batchId || profile?.batchId || null;
      const batch = batchKey ? batchMap.get(batchKey) : null;
      const marks = new Array(questionCols.length).fill(0);
      for (const a of r.answers || []) {
        const i = qIndexById.get(safeTrim(a.questionId));
        if (i !== undefined) marks[i] = toNum(a.marksAwarded);
      }
      return {
        sNo: idx + 1,
        classNo: r.classNo ?? profile?.classNo ?? null,
        batchCode: batch?.batchCode || null,
        batchName: batch?.batchName || null,
        admissionNo: r.admissionNo,
        studentName: r.studentName,
        marks
      };
    });
    data.sort((a, b) => safeTrim(a.studentName).localeCompare(safeTrim(b.studentName)));
    data.forEach((row, idx) => {
      row.sNo = idx + 1;
    });

    return res.status(200).json({
      status: true,
      message: 'Question-wise marks export loaded',
      exam: { examId, examName: exam.examName, examCode: exam.examCode, startTime: exam.startTime, totalMarks: exam.totalMarks },
      questions: questionCols,
      data,
      count: data.length
    });
  } catch (err) {
    return next(err);
  }
};

const getExamParticipantsReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const results = await MockExamResult.find(
      { tenantId, examId, isdeleted: false },
      {
        admissionNo: 1,
        studentId: 1,
        rank: 1,
        startedAt: 1,
        completedAt: 1,
        correctCount: 1,
        wrongCount: 1,
        totalMarks: 1,
        obtainedMarks: 1,
        timeTaken: 1
      }
    )
      .sort({ rank: 1 })
      .lean();

    const data = await populateStudentNames(tenantId, results);

    const finalData = data.map((r) => ({
      ...r,
      rank: r.rank || '-',
      percentage: r.totalMarks > 0 ? round2((r.obtainedMarks / r.totalMarks) * 100) : 0,
      timeTakenMins: round2(toNum(r.timeTaken) / 60000)
    }));

    return res.status(200).json({ status: true, message: 'Participants report loaded', data: finalData });
  } catch (err) {
    return next(err);
  }
};

const getStudentResultAdmin = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !admissionNo || !examId) {
      return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });
    }
    const result = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false }).populate('sectionResults.subjectId', 'subjectName').lean();
    if (!result) {
      return res.status(404).json({ status: false, message: 'Result not found for this student' });
    }
    const studentProfile = await StudentProfile.findOne(
      {
        tenantId,
        $or: [{ studentId: result.studentId }, { admissionNo: result.admissionNo }]
      },
      { 'student.name': 1 }
    ).lean();
    result.studentName = studentProfile?.student?.name || 'Unknown';
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examName: 1, examCode: 1, totalMarks: 1, totalQuestions: 1, sections: 1, status: 1, resultPublishedAt: 1, autoPublishAt: 1 }).lean();
    const questions = await MockExamQns.find(
      { tenantId, examId, isdeleted: false },
      {
        questionId: 1,
        sectionId: 1,
        questionType: 1,
        difficulty: 1,
        questionHtml: 1,
        questionOptions: 1,
        correctAnswer: 1,
        solutionHtml: 1,
        enableSolution: 1,
        positiveMarks: 1,
        negativeMarks: 1,
        hasPartialMarking: 1,
        numericMin: 1,
        numericMax: 1,
        passageId: 1,
        passageHtml: 1,
        instructionHtml: 1,
        leftColumn: 1,
        rightColumn: 1,
        topicId: 1,
        subTopicId: 1,
        tags: 1,
        sortOrder: 1,
        questionNo: 1
      }
    )
      .sort({ sectionId: 1, sortOrder: 1 })
      .populate('passageId', 'title passageHtml')
      .lean();
    const qMap = new Map(questions.map((q) => [safeTrim(q.questionId), q]));
    const answers = (result.answers || []).map((a) => {
      const q = qMap.get(safeTrim(a.questionId)) || null;
      return {
        questionId: a.questionId,
        sectionId: a.sectionId,
        answerRaw: a.answerRaw,
        correctAnswer: q ? (buildCorrectAnswer(q) ?? q.correctAnswer ?? null) : null,
        isCorrect: a.isCorrect,
        isSkipped: a.isSkipped,
        marksAwarded: a.marksAwarded,
        timeTaken: a.timeTaken || 0,
        positiveMarks: a.positiveMarks,
        negativeMarks: a.negativeMarks,
        hasPartialMarking: a.hasPartialMarking,
        questionNo: q?.questionNo || null,
        questionType: q?.questionType || null,
        difficulty: q?.difficulty || null,
        questionHtml: q?.questionHtml || null,
        questionOptions: q?.questionOptions || [],
        solutionHtml: q?.enableSolution || !!q?.solutionHtml ? q?.solutionHtml || null : null,
        instructionHtml: q?.instructionHtml || null,
        numericMin: q?.numericMin ?? null,
        numericMax: q?.numericMax ?? null,
        topicId: q?.topicId || null,
        subTopicId: q?.subTopicId || null,
        tags: q?.tags || [],
        sortOrder: q?.sortOrder ?? null,
        leftColumn: q?.leftColumn || [],
        rightColumn: q?.rightColumn || [],
        passage: q?.passageId ? { title: q.passageId?.title || null, passageHtml: q.passageId?.passageHtml || null } : q?.passageHtml ? { title: null, passageHtml: q.passageHtml } : null
      };
    });
    return res.status(200).json({
      status: true,
      message: 'Student result loaded',
      data: {
        examId,
        admissionNo,
        studentName: result.studentName,
        obtainedMarks: result.obtainedMarks,
        totalMarks: result.totalMarks,
        rank: result.rank,
        percentile: result.percentile,
        timeTaken: result.timeTaken,
        isLate: result.isLate,
        correctCount: result.correctCount ?? null,
        wrongCount: result.wrongCount ?? null,
        skippedCount: result.skippedCount ?? null,
        partialCount: result.partialCount ?? null,
        answeredCount: result.answeredCount ?? null,
        totalQuestions: result.totalQuestions,
        status: result.status,
        isResultVisible: result.isResultVisible,
        sectionResults: result.sectionResults,
        graceLogs: result.graceLogs || [],
        publishHistory: result.publishHistory || [],
        exam: exam || null,
        answers
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchSubjectStats = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const rawBatchId = safeTrim(req.body?.batchId);
    if (!tenantId || !examId || !rawBatchId) return res.status(400).json({ status: false, message: 'tenantId, examId and batchId are required' });
    const batchId = await resolveBatchId(tenantId, rawBatchId);
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { sections: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    // const batchResults = await MockExamResult.find({ tenantId, examId, batchId, isdeleted: false }, { sectionResults: 1 }).lean();
    const batchStudents = await StudentProfile.find({ tenantId, batchId, isdeleted: false, status: 'ACTIVE' }, { admissionNo: 1 }).lean();
    const batchAdmissionNos = batchStudents.map((s) => s.admissionNo).filter(Boolean);
    const batchResults = await MockExamResult.find({ tenantId, examId, admissionNo: { $in: batchAdmissionNos }, isdeleted: false }, { sectionResults: 1, obtainedMarks: 1 }).lean();
    const sectionNameMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s.sectionName || null]));
    const sectionStatsMap = new Map();
    for (const [sid, sname] of sectionNameMap.entries()) {
      sectionStatsMap.set(sid, { subjectName: sname, marks: [] });
    }
    for (const r of batchResults) {
      for (const sec of r.sectionResults || []) {
        const sid = safeTrim(sec.sectionId);
        if (!sectionStatsMap.has(sid)) {
          sectionStatsMap.set(sid, { subjectName: sec.subjectName || null, marks: [] });
        }
        sectionStatsMap.get(sid).marks.push(toNum(sec.obtainedMarks) || 0);
      }
    }
    const totalStudents = batchResults.length;
    for (const [sid, data] of sectionStatsMap.entries()) {
      const missing = totalStudents - data.marks.length;
      for (let i = 0; i < missing; i++) data.marks.push(0);
    }
    const data = Array.from(sectionStatsMap.entries()).map(([sectionId, d]) => {
      const marks = d.marks;
      const avg = marks.length ? round2(marks.reduce((s, m) => s + m, 0) / marks.length) : 0;
      const max = marks.length ? Math.max(...marks) : 0;
      return {
        sectionId,
        subjectName: d.subjectName,
        avgObtained: avg,
        maxObtained: max,
        studentCount: marks.length
      };
    });
    const batchHighestTotal = batchResults.length ? Math.max(...batchResults.map((r) => toNum(r.obtainedMarks) || 0)) : 0;
    return res.status(200).json({ status: true, examId, batchId, batchHighestTotal, data });
  } catch (err) {
    return next(err);
  }
};

const getParticipantReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { sections: 1, examName: 1, totalMarks: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const results = await MockExamResult.find({ tenantId, examId, isdeleted: false }, { admissionNo: 1, studentId: 1, batchId: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, sectionResults: 1, completedAt: 1, status: 1 }).lean();

    // Nothing ever flips an assignment's status to 'absent' — a student is absent if they were
    // assigned to this exam (via MockExamBatchAssign) but never completed a result (see
    // getExamAbsenteesReport, which uses the same inference).
    const assignments = await MockExamBatchAssign.find({ tenantId, examId, isdeleted: false, status: 'enabled' }, { batchId: 1, students: 1 }).lean();
    const completedAdmissionNos = new Set(results.filter((r) => r.completedAt || ['completed', 'evaluated', 'result_published'].includes(r.status)).map((r) => safeTrim(r.admissionNo)));
    const absenteeRows = [];
    for (const a of assignments) {
      for (const s of a.students || []) {
        const admNo = safeTrim(s.admissionNo);
        if (admNo && !completedAdmissionNos.has(admNo)) absenteeRows.push({ admissionNo: admNo, batchId: a.batchId });
      }
    }

    const admissionNos = [...new Set([...results.map((r) => r.admissionNo), ...absenteeRows.map((a) => a.admissionNo)].filter(Boolean))];
    const profiles = admissionNos.length ? await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, 'student.name': 1, classNo: 1, batchId: 1 }).lean() : [];
    const profileMap = new Map(profiles.map((p) => [p.admissionNo, { name: p.student?.name || '', classNo: p.classNo ?? null, batchId: p.batchId ?? null }]));

    // batchId has been observed holding a batchCode instead of the real batchId on some records
    // (see helpers/batch.helper.js) — resolve defensively by matching either field.
    const batchKeys = [
      ...new Set([...results.map((r) => r.batchId || profileMap.get(r.admissionNo)?.batchId), ...absenteeRows.map((a) => a.batchId || profileMap.get(a.admissionNo)?.batchId)].filter(Boolean))
    ];
    const batches = batchKeys.length ? await Batch.find({ tenantId, $or: [{ batchId: { $in: batchKeys } }, { batchCode: { $in: batchKeys } }] }, { batchId: 1, batchCode: 1, batchName: 1 }).lean() : [];
    const batchMap = new Map();
    for (const b of batches) {
      batchMap.set(b.batchId, b);
      batchMap.set(b.batchCode, b);
    }

    const sectionMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), safeTrim(s.sectionName)]));
    const data = results.map((r) => {
      const pct = r.totalMarks > 0 ? round2((r.obtainedMarks / r.totalMarks) * 100) : 0;
      const sectionData = {};
      for (const sec of r.sectionResults || []) {
        const sid = safeTrim(sec.sectionId);
        const sname = sectionMap.get(sid) || sid;
        sectionData[sname] = {
          obtainedMarks: sec.obtainedMarks || 0,
          totalMarks: sec.totalMarks || 0,
          correctCount: sec.correctCount || 0,
          wrongCount: sec.wrongCount || 0,
          skippedCount: sec.skippedCount || 0
        };
      }
      const profile = profileMap.get(r.admissionNo);
      const batchKey = r.batchId || profile?.batchId || null;
      const batch = batchKey ? batchMap.get(batchKey) : null;
      return {
        admissionNo: r.admissionNo,
        studentName: profile?.name || '—',
        classNo: profile?.classNo ?? null,
        batchCode: batch?.batchCode || null,
        batchName: batch?.batchName || null,
        obtainedMarks: r.obtainedMarks || 0,
        totalMarks: r.totalMarks || 0,
        percentage: pct,
        rank: r.rank || null,
        sections: sectionData
      };
    });
    data.sort((a, b) => (a.rank || 999) - (b.rank || 999));

    const absentees = absenteeRows.map((a) => {
      const profile = profileMap.get(a.admissionNo);
      const batchKey = a.batchId || profile?.batchId || null;
      const batch = batchKey ? batchMap.get(batchKey) : null;
      return {
        admissionNo: a.admissionNo,
        studentName: profile?.name || '—',
        classNo: profile?.classNo ?? null,
        batchCode: batch?.batchCode || null,
        batchName: batch?.batchName || null
      };
    });

    const sections = Array.from(sectionMap.values());
    return res.status(200).json({
      status: true,
      examName: exam.examName,
      totalMarks: exam.totalMarks,
      sections,
      data,
      count: data.length,
      absentees,
      absentCount: absentees.length
    });
  } catch (err) {
    return next(err);
  }
};

export { evalAnswer };

export default {
  submitResult,
  submitOfflineResult,
  submitOfflineResultsBulk,
  correctOfflineResult,
  getMyResult,
  getLeaderboard,
  listResultsByExam,
  listResultsByBatch,
  listResultsByStudent,
  getSectionAnalytics,
  getMyResultWithAnswers,
  getQuestionTimingAnalytics,
  getQuestionAttemptAnalytics,
  getBatchAttendanceReport,
  getExamAbsenteesReport,
  getBatchPerformanceReport,
  compareWithTopper,
  getExamQuestionWiseReport,
  getQuestionWiseMarksExport,
  getExamParticipantsReport,
  getStudentResultAdmin,
  getBatchSubjectStats,
  getParticipantReport
};
