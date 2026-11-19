import { useState } from "react";
import { useAdminStaff } from "@/api/adminApi";
import { useTenant } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Card, Pill, SectionTitle } from "@/components/ui/Card";
import { Modal, PageLoader } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { Mail, Plus, Shield, Users } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";

export function StaffPage() {
  const { tenant } = useTenant();
  const { data, isLoading } = useAdminStaff(tenant.slug);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    role: "RECRUITER",
    title: "",
  });

  if (isLoading) {
    return <PageLoader text="Loading team members..." />;
  }

  const staff = data?.items || [];

  return (
    <div className="page space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Team & Staff Members
          </h1>
          <p className="text-sm text-ink-muted">
            Manage recruiters, hiring managers, and interviewers for{" "}
            <span className="font-semibold text-ink-2">{tenant.name}</span>.
          </p>
        </div>

        <Button icon={<Plus size={18} />} onClick={() => setInviteOpen(true)}>
          Invite Team Member
        </Button>
      </div>

      <Card className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                <th className="pb-3 pl-2">Member</th>
                <th className="pb-3">Role & Title</th>
                <th className="pb-3">Access Level</th>
                <th className="pb-3">Added Date</th>
                <th className="pb-3 pr-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {staff.map((m) => (
                <tr key={m.id} className="hover:bg-canvas/50">
                  <td className="py-3.5 pl-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.user.displayName || m.user.email} size={34} />
                      <div>
                        <span className="font-semibold text-ink block">
                          {m.user.displayName || m.user.email}
                        </span>
                        <span className="text-[11px] text-ink-muted">{m.user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-xs text-ink-2">
                    <span className="font-medium text-ink block">{m.title || "Team Member"}</span>
                  </td>
                  <td className="py-3.5">
                    <Pill tone={m.role === "ADMIN" ? "amber" : m.role === "RECRUITER" ? "blue" : "gray"}>
                      {m.role}
                    </Pill>
                  </td>
                  <td className="py-3.5 text-xs text-ink-muted">{formatDate(m.createdAt)}</td>
                  <td className="py-3.5 pr-2 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Member Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite New Team Member"
        subtitle="An invitation link will be sent to their email to join your hiring organization."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setInviteOpen(false);
          }}
          className="space-y-4"
        >
          <Field label="Work Email Address" htmlFor="staff-email">
            <Input
              id="staff-email"
              type="email"
              placeholder="e.g. interviewer@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </Field>

          <Field label="Role & Permissions" htmlFor="staff-role">
            <Select
              id="staff-role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="ADMIN">Admin (Full tenant control & settings)</option>
              <option value="RECRUITER">Recruiter (Post jobs, advance stages, make offers)</option>
              <option value="INTERVIEWER">Interviewer (Conduct interviews & evaluate)</option>
            </Select>
          </Field>

          <Field label="Job Title" htmlFor="staff-title">
            <Input
              id="staff-title"
              placeholder="e.g. Senior Engineering Manager"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2.5 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Send Invitation</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
