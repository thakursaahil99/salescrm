import { useEffect, useState } from "react";
import { Plus, Key, Lock, Unlock } from "lucide-react";
import api from "../../../services/marketingApi.js";
import { useToast } from "../../../marketing-lib/useToast.js";
import { useAuth } from "../../../marketing-lib/useAuth.js";
import Modal from "../../../marketing-lib/Modal.jsx";
import PasswordInput from "../../../marketing-lib/PasswordInput.jsx";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [pwModal, setPwModal] = useState(null);
  const { push } = useToast();
  const { user: me } = useAuth();
  const isRealAdmin = me?.role === "admin";

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleFreeze = async (u) => {
    try {
      await api.patch(`/users/${u._id}/freeze`, { freeze: !u.frozen });
      push(`${u.username} ${u.frozen ? "unfrozen" : "frozen"}.`, "success");
      load();
    } catch (err) {
      push(err.response?.data?.msg || "Failed.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Users</h1>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
              <th className="p-3 sticky left-0 z-[2] bg-white">Username</th>
              <th className="p-3">Role</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id} className="group border-b border-gray-50">
                  <td className="p-3 font-semibold text-gray-800 sticky left-0 z-[1] bg-white group-hover:bg-gray-50">{u.username}</td>
                  <td className="p-3 capitalize text-gray-600">{u.role}</td>
                  <td className="p-3 text-gray-500">{u.email || "—"}</td>
                  <td className="p-3">
                    <span className={`badge ${u.frozen ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {u.frozen ? "Frozen" : "Active"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {(u.role !== "admin" || isRealAdmin) && (
                        <>
                          <button className="btn-icon" title="Change Password" onClick={() => setPwModal(u)}>
                            <Key size={15} />
                          </button>
                          <button className="btn-icon" title={u.frozen ? "Unfreeze" : "Freeze"} onClick={() => toggleFreeze(u)}>
                            {u.frozen ? <Unlock size={15} /> : <Lock size={15} />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} canMakeAdmin={isRealAdmin} />
      <ChangePasswordModal user={pwModal} open={!!pwModal} onClose={() => setPwModal(null)} />
    </div>
  );
}

function AddUserModal({ open, onClose, onSaved, canMakeAdmin }) {
  const [form, setForm] = useState({ username: "", password: "", role: "sales", email: "", email2: "" });
  const [saving, setSaving] = useState(false);
  const { push } = useToast();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/users", form);
      push("User added.", "success");
      setForm({ username: "", password: "", role: "sales", email: "", email2: "" });
      onSaved();
    } catch (err) {
      push(err.response?.data?.msg || "Failed to add user.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Username</label>
          <input className="input" value={form.username} onChange={set("username")} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Password</label>
          <PasswordInput value={form.password} onChange={set("password")} minLength={4} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Role</label>
          <select className="input" value={form.role} onChange={set("role")}>
            <option value="sales">Sales</option>
            <option value="manager">Manager</option>
            {canMakeAdmin && <option value="admin">Admin</option>}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
          <input className="input" value={form.email} onChange={set("email")} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Add User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangePasswordModal({ user, open, onClose }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => setPassword(""), [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/users/${user._id}/password`, { password });
      push("Password updated.", "success");
      onClose();
    } catch (err) {
      push(err.response?.data?.msg || "Failed to update password.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Change Password — ${user?.username || ""}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">New Password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={4} required />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Update"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
