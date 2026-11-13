// Allowlist for study/preview responses. Solutions belong to completed-attempt review.
const studentQuestions = (questions = []) => questions.map((question) => ({
  _id: question._id,
  noiDungCauHoi: question.noiDungCauHoi,
  cacDapAn: (question.cacDapAn || []).map((answer) => ({
    _id: answer._id,
    noiDungDapAn: answer.noiDungDapAn,
  })),
}));

module.exports = studentQuestions;
