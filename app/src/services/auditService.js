import api from "./api.js";

export const listReversals = (params) => api.get("/audit/reversals", { params }).then((r) => r.data);
export const listMistakes = (params) => api.get("/audit/mistakes", { params }).then((r) => r.data);
