const BaiGiang = require('../models/BaiGiang');
const LopHoc = require('../models/LopHoc');

// Filter the complete student's collection/history before counting and paging.
module.exports = async function studentListingPage(Model, userId, params = {}) {
  const limit = Math.min(60, Math.max(1, parseInt(params.limit, 10) || 6));
  const requestedPage = Math.max(1, parseInt(params.page, 10) || 1);
  const search = String(params.search || '').trim().slice(0, 200);
  const base = { id_hoc_sinh: userId };
  const query = { ...base };
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = { $regex: literal, $options: 'i' };
    const classes = await LopHoc.find({ ten_lop: expression }).select('_id').lean();
    const lessons = await BaiGiang.find({ $or: [
      { ten_bai_giang: expression }, { id_lop_hoc: { $in: classes.map(item => item._id) } },
    ] }).select('_id').lean();
    query.id_bai_giang = { $in: lessons.map(item => item._id) };
  }
  const total = await Model.countDocuments(query);
  const unfilteredTotal = search ? await Model.countDocuments(base) : total;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / limit)));
  return { query, skip: (page - 1) * limit,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { total: unfilteredTotal },
  };
};
