import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input, Select } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { LEAD_SOURCE, optionsFrom } from "../../utils/constants.js";
import { createLead, updateLead } from "../../services/leadService.js";
import { getAssignable } from "../../services/userService.js";

export default function LeadFormModal({ open, onClose, onSaved, lead }) {
  const { user } = useAuth();
  const toast = useToast();
  const editing = !!lead;
  const canAssign = user.role !== ROLES.SALESPERSON;
  const [people, setPeople] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!open) return;
    if (canAssign) getAssignable().then(setPeople).catch(() => {});
  }, [open, canAssign]);

  // Populate the form only when the modal opens (or the target lead changes) —
  // the lead detail page polls in the background and re-creates the `lead`
  // object, and reacting to that here would discard edits in progress.
  useEffect(() => {
    if (!open) return;
    reset({
      name: lead?.name || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
      restaurantName: lead?.restaurantName || "",
      city: lead?.city || "",
      state: lead?.state || "",
      source: lead?.source || "other",
      potentialValue: lead?.potentialValue || "",
      nextFollowUpDate: lead?.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 10) : "",
      assignedTo: lead?.assignedTo?._id || lead?.assignedTo || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?._id]);

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      phone: (values.phone || "").replace(/\D/g, ""),
      potentialValue: Number(values.potentialValue) || 0,
      nextFollowUpDate: values.nextFollowUpDate || undefined,
    };
    if (!canAssign) delete payload.assignedTo;
    try {
      const saved = editing ? await updateLead(lead._id, payload) : await createLead(payload);
      toast.success(editing ? "Lead updated." : "Lead added.");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${lead.name}` : "New lead"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
        <Input
          label="Contact name"
          required
          error={errors.name?.message}
          {...register("name", { required: "Name is required." })}
        />
        <Input
          label="Phone"
          required
          inputMode="numeric"
          maxLength={14}
          placeholder="10-digit number"
          error={errors.phone?.message}
          {...register("phone", {
            required: "Phone is required.",
            validate: (v) =>
              (v || "").replace(/\D/g, "").length === 10 || "Enter a 10-digit phone number.",
          })}
        />
        <Input label="Email" type="email" {...register("email")} />
        <Input label="Restaurant / brand" {...register("restaurantName")} />
        <Input label="City" {...register("city")} />
        <Input label="State" {...register("state")} />
        <Select
          label="Source"
          options={optionsFrom(LEAD_SOURCE)}
          {...register("source")}
        />
        <Input
          label="Potential value (₹)"
          type="number"
          min="0"
          {...register("potentialValue")}
        />
        <Input label="Next follow-up" type="date" {...register("nextFollowUpDate")} />
        {canAssign && (
          <Select
            label="Assign to"
            placeholder="— Me —"
            options={people.map((p) => ({ value: p._id, label: p.name }))}
            {...register("assignedTo")}
          />
        )}
      </form>
    </Modal>
  );
}
