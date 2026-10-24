"use client";

import { FormEvent, useEffect, useState } from "react";
import OwnerTabs from "./OwnerTabs";
import { apiFetch } from "@/lib/client/api";

type Profile = { name: string; username: string; phone: string };

export default function OwnerMyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/profile", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error("Could not load owner details. Sign in again and retry.");
        setProfile(data);
        setUsername(data.username);
        setName(data.name);
        setPhone(data.phone);
      })
      .catch((reason) => setError((reason as Error).message));
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!newPassword.trim()) {
      setError("Enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "RATE_LIMITED" ? "Too many password changes. Try again later." : data.error === "INVALID_LOGIN" ? "The current password is incorrect." : "Could not change the password. Sign in again and retry.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed. You are still signed in on this device.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await apiFetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "RATE_LIMITED" ? "Too many profile changes. Try again later." : data.error === "INVALID_INPUT" ? "Check the username and phone number, then try again." : "Could not save owner details. Sign in again and retry.");
      setProfile((current) => current ? { ...current, ...data } : current);
      setMessage("Owner details saved.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <OwnerTabs />
      <section>
        <p className="eyebrow">OWNER ACCOUNT</p>
        <h1>My Page</h1>
        <p>Owner contact details and account password.</p>
        {profile ? (
          <form className="admin-settings owner-profile-password" onSubmit={saveProfile}>
            <h2>Owner details</h2>
            <label>Username used to sign in<input name="username" autoComplete="username" minLength={3} maxLength={100} pattern="[A-Za-z0-9_.-]+" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
            <label>Owner name<input name="name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="01012345678" value={phone} onChange={(event) => setPhone(event.target.value)} /><small>Enter a Korean mobile number, for example 01012345678.</small></label>
            <button disabled={busy}>{busy ? "Saving…" : "Save owner details"}</button>
          </form>
        ) : <p role="status">Loading owner details…</p>}

        <form className="admin-settings owner-profile-password" onSubmit={savePassword}>
          <h2>Change password</h2>
          <p>Confirm the current password before setting a new one.</p>
          <label>
            Current password
            <input type="password" autoComplete="current-password" maxLength={256} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
          <label>
            New password
            <input type="password" autoComplete="new-password" maxLength={256} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </label>
          <label>
            Confirm new password
            <input type="password" autoComplete="new-password" maxLength={256} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </label>
          <button disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
        <p role="status">{message}</p>
        <p role="alert">{error}</p>
      </section>
    </main>
  );
}
