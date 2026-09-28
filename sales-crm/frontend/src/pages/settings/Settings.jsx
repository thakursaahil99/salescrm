import { useState } from "react";
import { useForm } from "react-hook-form";
import { MdOutlineEdit, MdClose, MdCheck } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { Input } from "../../components/ui/Field.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import useConversionTypes from "../../hooks/useConversionTypes.js";
import { ROLE_LABELS } from "../../utils/roles.js";
import { initials, inrCompact } from "../../utils/format.js";
import { updateProfile, changePassword } from "../../services/authService.js";
import { createConversionType, updateConversionType } from "../../services/conversionTypeService.js";

function ProfileForm() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      name: user.name,
      phone: user.phone || "",
      city: user.city || "",
      state: user.state || "",
    },
  });

  const onSubmit = async (values) => {
    try {
      await updateProfile(values);
      await refresh?.();
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold text-gray-800 mb-4">Profile</h2>
      <div className="flex items-center gap-4 mb-5">
        <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center text-lg font-semibold">
          {initials(user.name)}
        </div>
        <div>
          <p className="font-medium text-gray-800">{user.email}</p>
          <p className="text-sm text-gray-400">
            {ROLE_LABELS[user.role]}
            {user.username ? ` · @${user.username}` : ""}
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Full name"
            required
            error={errors.name?.message}
            {...register("name", { required: "Name is required." })}
          />
          <Input label="Phone" {...register("phone")} />
          <Input label="City" {...register("city")} />
          <Input label="State" {...register("state")} />
        </div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Password changed.");
      reset();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold text-gray-800 mb-4">Change password</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
        <Input
          label="Current password"
          type="password"
          required
          error={errors.currentPassword?.message}
          {...register("currentPassword", { required: "Required." })}
        />
        <Input
          label="New password"
          type="password"
          required
          error={errors.newPassword?.message}
          {...register("newPassword", {
            required: "Required.",
            minLength: { value: 6, message: "At least 6 characters." },
          })}
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          error={errors.confirm?.message}
          {...register("confirm", {
            validate: (v) => v === watch("newPassword") || "Passwords don't match.",
          })}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}

// Conversion types (IFO, RBC, and anything else the team wants to track) are
// company-wide, not per-user. Adding/renaming is admin & manager only (the
// card itself is only rendered for those roles — see Settings() below);
// everyone else still reads the same list wherever a conversion type is
// picked or filtered, via the same GET this card's own list uses.
function ConversionTypesCard() {
  const toast = useToast();
  const { types, loading, reload } = useConversionTypes();
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the new type a name.");
    setBusy(true);
    try {
      await createConversionType({ name: name.trim(), defaultValue: Number(defaultValue) || 0 });
      toast.success(`"${name.trim()}" added — it'll show up wherever conversion type is picked.`);
      setName("");
      setDefaultValue("");
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditName(t.label);
    setEditValue(t.defaultValue || "");
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    if (!editName.trim()) return toast.error("A name is required.");
    setEditBusy(true);
    try {
      await updateConversionType(id, { name: editName.trim(), defaultValue: Number(editValue) || 0 });
      toast.success("Saved.");
      setEditingId(null);
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold text-gray-800 mb-1">Conversion types</h2>
      <p className="text-xs text-gray-400 mb-4">
        IFO and RBC come built in. Add another type here and it becomes available for anyone recording a
        conversion, filtering reports, and on the dashboard.
      </p>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-2 mb-4">
          {types.map((t) =>
            editingId === t.id ? (
              <div key={t.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-2.5">
                <div className="flex-1 min-w-[140px]">
                  <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="w-36">
                  <Input
                    label="Default deal value (₹)"
                    type="number"
                    min="0"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                </div>
                <Button size="sm" disabled={editBusy} onClick={() => saveEdit(t.id)} title="Save">
                  <MdCheck size={16} />
                </Button>
                <Button variant="secondary" size="sm" disabled={editBusy} onClick={cancelEdit} title="Cancel">
                  <MdClose size={16} />
                </Button>
              </div>
            ) : (
              <div key={t.id} className="flex items-center gap-2">
                <Badge color={t.color}>
                  {t.label}
                  {t.defaultValue ? ` · ₹${inrCompact(t.defaultValue)}` : ""}
                </Badge>
                <button
                  onClick={() => startEdit(t)}
                  className="text-gray-400 hover:text-primary p-1"
                  title={`Edit "${t.label}"`}
                >
                  <MdOutlineEdit size={15} />
                </button>
              </div>
            )
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <Input
          label="New type name"
          placeholder="e.g. Franchise"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="sm:w-40">
          <Input
            label="Default deal value (₹)"
            type="number"
            min="0"
            placeholder="0"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add type"}
        </Button>
      </form>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const canManageConversionTypes = user?.role === "admin" || user?.role === "manager";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and account security." />
      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <ProfileForm />
        <PasswordForm />
        {canManageConversionTypes && (
          <div className="xl:col-span-2">
            <ConversionTypesCard />
          </div>
        )}
      </div>
    </div>
  );
}
