import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createStaffAccount, loadStaffAccounts, updateStaffEnabled, updateStaffRoles, type AdminStaff } from "../../api/adminStaffManagement";
import type { StaffRole } from "../../auth/staffSession";

const roles: StaffRole[] = ["RECEPTION", "NURSE", "CHECKOUT"];
const roleLabel: Record<StaffRole, string> = { RECEPTION: "Reception", NURSE: "Nursing", CHECKOUT: "Checkout" };

function AdminStaffManagement() {
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<number, StaffRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newRoles, setNewRoles] = useState<StaffRole[]>(["RECEPTION"]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await loadStaffAccounts(); setStaff(result);
      setDraftRoles(Object.fromEntries(result.map((item) => [item.id, item.roles])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load staff accounts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  function toggleRole(value: StaffRole, selected: StaffRole[], update: (next: StaffRole[]) => void) {
    update(selected.includes(value) ? selected.filter((role) => role !== value) : [...selected, value]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      await createStaffAccount({ fullName: fullName.trim(), email: email.trim(), mobileNumber: mobileNumber.trim(), temporaryPassword, roles: newRoles });
      setFullName(""); setEmail(""); setMobileNumber(""); setTemporaryPassword(""); setNewRoles(["RECEPTION"]);
      setSuccess("Staff account created. Share its individual temporary password with the staff member through your approved secure channel.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create staff account."); }
    finally { setSaving(false); }
  }
  async function saveRoles(item: AdminStaff) {
    setSaving(true); setError(""); setSuccess("");
    try { await updateStaffRoles(item.id, draftRoles[item.id] ?? []); setSuccess(`Roles updated for ${item.fullName}. Their existing sessions must sign in again.`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update staff roles."); }
    finally { setSaving(false); }
  }
  async function toggleEnabled(item: AdminStaff) {
    setSaving(true); setError(""); setSuccess("");
    try { await updateStaffEnabled(item.id, !item.enabled); setSuccess(`${item.fullName} account ${item.enabled ? "disabled" : "enabled"}.`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update account status."); }
    finally { setSaving(false); }
  }

  return <section className="admin-staff-page">
    <div className="admin-staff-intro"><div><span className="admin-staff-eyebrow">TEAM ACCESS</span><h2>Staff accounts</h2><p>Create individual staff accounts and assign one or more clinic roles.</p></div><div className="admin-staff-count"><strong>{staff.length}</strong><span>staff accounts</span></div></div>
    <form className="admin-staff-create" onSubmit={(event) => void submit(event)}>
      <div className="admin-staff-section-heading"><div><span className="admin-staff-eyebrow">NEW ACCOUNT</span><h3>Create staff member</h3></div></div>
      <div className="admin-staff-form-grid">
        <label>Full name<input required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
        <label>Email<input required type="email" maxLength={160} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Mobile number<input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value.replace(/\D/g, ""))} /></label>
        <label>Individual temporary password<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /><small>12–72 characters. Never reuse a shared password.</small></label>
      </div>
      <fieldset className="admin-staff-role-fieldset"><legend>Assigned roles</legend>{roles.map((role) => <label key={role}><input type="checkbox" checked={newRoles.includes(role)} onChange={() => toggleRole(role, newRoles, setNewRoles)} />{roleLabel[role]}</label>)}</fieldset>
      <button className="admin-staff-primary" type="submit" disabled={saving || newRoles.length === 0}>{saving ? "Saving…" : "Create staff account"}</button>
    </form>
    {(error || success) && <div className={`admin-staff-feedback ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>{error || success}</div>}
    <section className="admin-staff-list-card"><div className="admin-staff-list-heading"><div><span className="admin-staff-eyebrow">ACCESS DIRECTORY</span><h3>Manage staff</h3></div><button type="button" className="admin-staff-secondary" onClick={() => void refresh()} disabled={loading}>Refresh</button></div>
      {loading ? <p className="admin-staff-state" role="status">Loading staff accounts…</p> : error && staff.length === 0 ? <div className="admin-staff-empty"><p>Staff accounts could not be loaded.</p><button type="button" className="admin-staff-secondary" onClick={() => void refresh()}>Retry</button></div> : staff.length === 0 ? <div className="admin-staff-empty">No staff accounts yet. Create an individual account above.</div> : <div className="admin-staff-table-wrap"><table className="admin-staff-table"><thead><tr><th>Staff member</th><th>Roles</th><th>Status</th><th>Account</th><th>Actions</th></tr></thead><tbody>{staff.map((item) => {
        const selected = draftRoles[item.id] ?? [];
        const changed = selected.length !== item.roles.length || selected.some((role) => !item.roles.includes(role));
        return <tr key={item.id}><td><strong>{item.fullName}</strong><small>{item.email}{item.mobileNumber ? ` · ${item.mobileNumber}` : ""}</small></td><td><div className="admin-staff-row-roles">{roles.map((role) => <label key={role}><input type="checkbox" checked={selected.includes(role)} onChange={() => setDraftRoles((current) => ({ ...current, [item.id]: selected.includes(role) ? selected.filter((entry) => entry !== role) : [...selected, role] }))} />{roleLabel[role]}</label>)}</div></td><td><span className={`admin-staff-status ${item.enabled ? "is-enabled" : "is-disabled"}`}>{item.enabled ? "Enabled" : "Disabled"}</span></td><td>{item.roles.map((role) => <span className="admin-staff-role-pill" key={role}>{roleLabel[role]}</span>)}</td><td><div className="admin-staff-row-actions"><button type="button" className="admin-staff-secondary" disabled={saving || !changed} onClick={() => void saveRoles(item)}>Save roles</button><button type="button" className={item.enabled ? "admin-staff-danger" : "admin-staff-primary"} disabled={saving} onClick={() => void toggleEnabled(item)}>{item.enabled ? "Disable" : "Enable"}</button></div></td></tr>;
      })}</tbody></table></div>}
    </section>
  </section>;
}

export default AdminStaffManagement;
