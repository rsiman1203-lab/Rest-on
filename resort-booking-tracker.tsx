import { useState, useMemo } from "react";

const UNITS = [
  { id: "c1", label: "Cottage 1", type: "cottage" },
  { id: "c2", label: "Cottage 2", type: "cottage" },
  { id: "c3", label: "Cottage 3", type: "cottage" },
  { id: "c4", label: "Cottage 4", type: "cottage" },
  { id: "c5", label: "Cottage 5", type: "cottage" },
  { id: "c6", label: "Cottage 6", type: "cottage" },
  { id: "r1", label: "Room 1", type: "room" },
  { id: "r2", label: "Room 2", type: "room" },
  { id: "r3", label: "Room 3", type: "room" },
];

const ALL_UNIT_IDS = UNITS.map(u => u.id);

const ACCOM_TYPES = {
  dayTour:   { label: "Day Tour",  icon: "☀️", timeIn: "8:00 AM", timeOut: "5:00 PM",            color: "#fbbf24" },
  overnight: { label: "Overnight", icon: "🌙", timeIn: "7:00 PM", timeOut: "6:00 AM (next day)", color: "#818cf8" },
};

const STATUS_COLORS = {
  confirmed: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  pending:   { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  cancelled: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

const today = new Date().toISOString().split("T")[0];

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// Check if a booking has a paired companion (same guest+units+date, other type)
function getPairedId(b, allBookings) {
  const otherType = b.accomType === "dayTour" ? "overnight" : "dayTour";
  const pair = allBookings.find(x =>
    x.id !== b.id &&
    x.guestName === b.guestName &&
    x.date === b.date &&
    x.accomType === otherType &&
    JSON.stringify([...x.units].sort()) === JSON.stringify([...b.units].sort())
  );
  return pair ? pair.id : null;
}

const SAMPLE_BOOKINGS = [
  { id: 1, guestName: "Maria Santos",   units: ["c1"],           exclusive: false, date: today,            accomType: "dayTour",  pax: 2,  contact: "maria@email.com", address: "", status: "confirmed", notes: "Anniversary couple" },
  { id: 2, guestName: "Juan dela Cruz", units: ["r2"],           exclusive: false, date: addDays(today,1), accomType: "overnight", pax: 1,  contact: "juan_dc",        address: "", status: "pending",   notes: "" },
  { id: 3, guestName: "Reyes Family",   units: ["c2","c3","c4"], exclusive: false, date: addDays(today,2), accomType: "dayTour",  pax: 12, contact: "reyes_fb",        address: "", status: "confirmed", notes: "Family reunion" },
  { id: 4, guestName: "Reyes Family",   units: ["c2","c3","c4"], exclusive: false, date: addDays(today,2), accomType: "overnight", pax: 12, contact: "reyes_fb",       address: "", status: "confirmed", notes: "Family reunion" },
];

export default function App() {
  const [bookings, setBookings]         = useState(SAMPLE_BOOKINGS);
  const [showForm, setShowForm]         = useState(false);
  const [editBooking, setEditBooking]   = useState(null);
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType]     = useState("all");
  const [view, setView]                 = useState("list");
  const [nextId, setNextId]             = useState(5);
  const [toast, setToast]               = useState(null);

  const emptyForm = { guestName: "", units: ["c1"], exclusive: false, date: today, accomType: "dayTour", pax: 1, contact: "", address: "", status: "confirmed", notes: "" };
  const [form, setForm] = useState(emptyForm);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openNew()   { setEditBooking(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(b) { setEditBooking(b.id); setForm({ ...b, units: [...b.units] }); setShowForm(true); }

  // Duplicate a day tour as overnight (or vice versa) — pre-fills form with other type
  function duplicateAsOther(b) {
    const otherType = b.accomType === "dayTour" ? "overnight" : "dayTour";
    // Check if pair already exists
    const alreadyPaired = getPairedId(b, bookings);
    if (alreadyPaired) return showToast("A paired booking already exists for this guest!", "error");
    setEditBooking(null);
    setForm({ ...b, units: [...b.units], accomType: otherType, id: undefined });
    setShowForm(true);
    showToast(`Pre-filled as ${ACCOM_TYPES[otherType].label} — review and save to create the 22-hr pair ✨`);
  }

  function toggleUnit(uid) {
    if (form.exclusive) return;
    setForm(f => {
      const has = f.units.includes(uid);
      const next = has ? f.units.filter(u => u !== uid) : [...f.units, uid];
      return { ...f, units: next.length ? next : [uid] };
    });
  }

  function toggleExclusive() {
    setForm(f => ({ ...f, exclusive: !f.exclusive, units: !f.exclusive ? ALL_UNIT_IDS : ["c1"] }));
  }

  // Time windows in hours from midnight for conflict detection
  const timeWindows = { dayTour: [8, 17], overnight: [19, 30] };

  function overlaps(aType, aDate, bType, bDate) {
    const [as, ae] = timeWindows[aType];
    const [bs, be] = timeWindows[bType];
    const offsetHrs = (new Date(bDate + "T00:00:00") - new Date(aDate + "T00:00:00")) / 3600000;
    const bStart = bs + offsetHrs, bEnd = be + offsetHrs;
    return as < bEnd && ae > bStart;
  }

  function saveBooking() {
    if (!form.guestName || !form.date || !form.units.length) return showToast("Fill in all required fields", "error");
    for (const uid of form.units) {
      const conflict = bookings.find(b =>
        b.id !== editBooking &&
        b.status !== "cancelled" &&
        b.units.includes(uid) &&
        overlaps(form.accomType, form.date, b.accomType, b.date)
      );
      if (conflict) {
        const uLabel = UNITS.find(u => u.id === uid)?.label;
        return showToast(`⚠️ ${uLabel} conflicts with ${conflict.guestName} (${ACCOM_TYPES[conflict.accomType].label} on ${formatDate(conflict.date)})`, "error");
      }
    }
    if (editBooking) {
      setBookings(bs => bs.map(b => b.id === editBooking ? { ...form, id: editBooking } : b));
      showToast("Booking updated!");
    } else {
      setBookings(bs => [...bs, { ...form, id: nextId }]);
      setNextId(n => n + 1);
      showToast("Booking added!");
    }
    setShowForm(false);
  }

  function deleteBooking(id) { setBookings(bs => bs.filter(b => b.id !== id)); showToast("Booking removed"); }

  function unitsLabel(b) {
    if (b.exclusive) return "🏝️ Exclusive Resort";
    if (b.units.length === 1) return UNITS.find(u => u.id === b.units[0])?.label;
    return b.units.map(uid => UNITS.find(u => u.id === uid)?.label).join(", ");
  }

  function generateMessengerReply(b) {
    const at = ACCOM_TYPES[b.accomType];
    const spansNext = b.accomType === "overnight";
    const nextDay = spansNext ? ` (${formatDate(addDays(b.date, 1))})` : "";
    const unitLine = b.exclusive ? "🏝️ Exclusive Resort (all cottages & rooms)" : `📍 ${unitsLabel(b)}`;
    const pairedId = getPairedId(b, bookings);
    const is22hr = pairedId !== null;
    return `Hi ${b.guestName}! 🌴 Thank you for choosing our resort!\n\n✅ Your booking is ${b.status.toUpperCase()}:${is22hr ? "\n⏳ 22-Hour Package (Day Tour + Overnight)" : ""}\n${at.icon} ${at.label}\n${unitLine}\n📅 Date: ${formatDate(b.date)}\n⏰ Time In: ${at.timeIn}\n⏰ Time Out: ${at.timeOut}${nextDay}\n👥 ${b.pax} guest${b.pax !== 1 ? "s" : ""}${b.address ? `\n🏠 Address: ${b.address}` : ""}${b.notes ? `\n📝 Note: ${b.notes}` : ""}\n\nWe look forward to welcoming you! If you have any questions, feel free to message us. 😊\n\n— The Resort Team`;
  }

  const filtered = useMemo(() => bookings.filter(b => {
    const ms  = b.guestName.toLowerCase().includes(search.toLowerCase()) || b.contact.toLowerCase().includes(search.toLowerCase());
    const mst = filterStatus === "all" || b.status === filterStatus;
    const mty = filterType === "all" || b.accomType === filterType;
    return ms && mst && mty;
  }), [bookings, search, filterStatus, filterType]);

  const stats = useMemo(() => ({
    total:     bookings.filter(b => b.status !== "cancelled").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    pending:   bookings.filter(b => b.status === "pending").length,
    pairs22:   bookings.filter(b => b.accomType === "dayTour" && b.status !== "cancelled" && getPairedId(b, bookings) !== null).length,
  }), [bookings]);

  const calDays = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const inputStyle  = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#f0ede8", fontFamily: "Georgia", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const selectStyle = { ...inputStyle, background: "#1a2f3a" };
  const labelStyle  = { fontSize: 12, color: "#a0bcc8", display: "block", marginBottom: 5 };

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: "linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)", color: "#f0ede8" }}>
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, background: toast.type === "error" ? "#fee2e2" : "#d1fae5", color: toast.type === "error" ? "#991b1b" : "#065f46", padding: "12px 20px", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", fontSize: 13, maxWidth: 340 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1, color: "#f9d77e" }}>🌴 Resort Booking Tracker</div>
          <div style={{ fontSize: 12, color: "#a0bcc8", marginTop: 2 }}>6 Cottages · 3 Rooms · ☀️ Day Tour & 🌙 Overnight</div>
        </div>
        <button onClick={openNew} style={{ background: "#f9d77e", color: "#1a1a1a", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "Georgia" }}>
          + New Booking
        </button>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Active Bookings",  value: stats.total,     icon: "📋" },
            { label: "Confirmed",        value: stats.confirmed, icon: "✅" },
            { label: "Pending",          value: stats.pending,   icon: "⏳" },
            { label: "22-Hr Packages",   value: stats.pairs22,   icon: "⏰" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#f9d77e", lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#a0bcc8", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Accom type legend */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { icon: "☀️", label: "Day Tour",   time: "8:00 AM → 5:00 PM",            color: "#fbbf24" },
            { icon: "🌙", label: "Overnight",  time: "7:00 PM → 6:00 AM (next day)", color: "#818cf8" },
            { icon: "⏰", label: "22-Hr Package", time: "Day Tour + Overnight paired",  color: "#34d399" },
          ].map(at => (
            <div key={at.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", border: `1px solid ${at.color}44` }}>
              <div style={{ fontSize: 18 }}>{at.icon}</div>
              <div style={{ fontWeight: 700, color: at.color, fontSize: 13 }}>{at.label}</div>
              <div style={{ fontSize: 11, color: "#a0bcc8" }}>{at.time}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest or contact..." style={{ flex: 1, minWidth: 180, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#f0ede8", fontFamily: "Georgia", fontSize: 13, outline: "none" }} />
          {["all","confirmed","pending","cancelled"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "8px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "Georgia", fontWeight: 600, fontSize: 12, background: filterStatus === s ? "#f9d77e" : "rgba(255,255,255,0.1)", color: filterStatus === s ? "#1a1a1a" : "#a0bcc8" }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: "8px 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "#1a2f3a", color: "#f9d77e", fontFamily: "Georgia", fontSize: 12, outline: "none" }}>
            <option value="all">All Types</option>
            <option value="dayTour">☀️ Day Tour</option>
            <option value="overnight">🌙 Overnight</option>
          </select>
          <button onClick={() => setView(v => v === "list" ? "calendar" : "list")} style={{ padding: "8px 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#f9d77e", cursor: "pointer", fontFamily: "Georgia", fontSize: 12 }}>
            {view === "list" ? "📅 Calendar" : "📋 List"}
          </button>
        </div>

        {/* Calendar */}
        {view === "calendar" && (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,0.1)", overflowX: "auto", marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#f9d77e" }}>14-Day Availability</div>
            <div style={{ display: "grid", gridTemplateColumns: `140px repeat(14,1fr)`, gap: 2, minWidth: 960 }}>
              <div/>
              {calDays.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 10, color: d === today ? "#f9d77e" : "#a0bcc8", fontWeight: d === today ? 700 : 400, padding: "4px 2px" }}>
                  {new Date(d + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}
                </div>
              ))}
              {UNITS.map(unit => (
                <>
                  <div key={unit.id + "_l"} style={{ fontSize: 11, color: "#f0ede8", padding: "6px 8px", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    {unit.type === "cottage" ? "🏡" : "🛏"} {unit.label}
                  </div>
                  {calDays.map(d => {
                    const dayB   = bookings.find(b => b.status !== "cancelled" && b.units.includes(unit.id) && b.accomType === "dayTour"  && b.date === d);
                    const nightB = bookings.find(b => b.status !== "cancelled" && b.units.includes(unit.id) && b.accomType === "overnight" && b.date === d);
                    // overnight from prev day spills into today
                    const nightPrev = bookings.find(b => b.status !== "cancelled" && b.units.includes(unit.id) && b.accomType === "overnight" && addDays(b.date,1) === d);
                    const is22Day   = dayB   && getPairedId(dayB,   bookings) !== null;
                    const is22Night = nightB && getPairedId(nightB, bookings) !== null;
                    return (
                      <div key={unit.id + d} style={{ height: 26, borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", display: "flex", overflow: "hidden", gap: 1 }}>
                        <div title={dayB ? `☀️ ${dayB.guestName}${is22Day?" (22hr)":""}` : "Day: Available"}
                          style={{ flex: 1, background: dayB ? (is22Day ? "#34d399" : (dayB.status === "confirmed" ? "#fbbf24" : "#fbbf2488")) : "rgba(255,255,255,0.04)", cursor: dayB ? "pointer" : "default" }}
                          onClick={() => dayB && openEdit(dayB)} />
                        <div title={(nightB || nightPrev) ? `🌙 ${(nightB||nightPrev).guestName}${is22Night?" (22hr)":""}` : "Night: Available"}
                          style={{ flex: 1, background: (nightB || nightPrev) ? (is22Night ? "#34d399" : ((nightB||nightPrev).status === "confirmed" ? "#818cf8" : "#818cf888")) : "rgba(255,255,255,0.04)", cursor: (nightB||nightPrev) ? "pointer" : "default" }}
                          onClick={() => (nightB||nightPrev) && openEdit(nightB||nightPrev)} />
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "#a0bcc8" }}>
              {[["#fbbf24","☀️ Day Tour"],["#818cf8","🌙 Overnight"],["#34d399","⏰ 22-Hr Pair"]].map(([c,l]) => (
                <span key={l}><span style={{ display: "inline-block", width: 12, height: 12, background: c, borderRadius: 2, marginRight: 4 }}/>{l}</span>
              ))}
              <span><span style={{ display: "inline-block", width: 12, height: 12, background: "rgba(255,255,255,0.04)", borderRadius: 2, marginRight: 4, border: "1px solid rgba(255,255,255,0.1)" }}/>Available</span>
            </div>
          </div>
        )}

        {/* Booking List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#a0bcc8" }}>No bookings found.</div>}
          {[...filtered].sort((a, b) => a.date.localeCompare(b.date)).map(b => {
            const sc = STATUS_COLORS[b.status];
            const at = ACCOM_TYPES[b.accomType];
            const pairedId = getPairedId(b, bookings);
            const is22 = pairedId !== null;
            return (
              <div key={b.id} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 20px", border: `1px solid ${is22 ? "#34d39944" : at.color + "33"}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 28 }}>{b.exclusive ? "🏝️" : at.icon}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#f0ede8" }}>{b.guestName}</div>
                    <span style={{ background: at.color + "33", color: at.color, borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{at.icon} {at.label}</span>
                    {is22 && <span style={{ background: "#34d39922", color: "#34d399", borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>⏰ 22-Hr Package</span>}
                    {b.exclusive && <span style={{ background: "#f9d77e22", color: "#f9d77e", borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>🏝️ Exclusive</span>}
                    {!b.exclusive && b.units.length > 1 && <span style={{ background: "rgba(255,255,255,0.1)", color: "#a0bcc8", borderRadius: 10, padding: "2px 10px", fontSize: 11 }}>{b.units.length} units</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#a0bcc8", marginTop: 3 }}>{unitsLabel(b)} · {b.pax} guest{b.pax !== 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 12, color: "#7ba3b0", marginTop: 2 }}>📅 {formatDate(b.date)} · ⏰ {at.timeIn} → {at.timeOut}</div>
                  {b.contact && <div style={{ fontSize: 12, color: "#7ba3b0" }}>📱 {b.contact}</div>}
                  {b.address && <div style={{ fontSize: 12, color: "#7ba3b0" }}>🏠 {b.address}</div>}
                  {b.notes && <div style={{ fontSize: 12, color: "#7ba3b0", fontStyle: "italic" }}>"{b.notes}"</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={{ background: sc.bg, color: sc.text, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: sc.dot, marginRight: 5 }}/>
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => { navigator.clipboard.writeText(generateMessengerReply(b)); showToast("Messenger reply copied! 📋"); }}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#1877f2", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "Georgia", fontWeight: 600 }}>
                      💬 Copy Reply
                    </button>
                    {/* Show duplicate button only if not yet paired */}
                    {!is22 && (
                      <button onClick={() => duplicateAsOther(b)}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #34d39966", background: "#34d39911", color: "#34d399", cursor: "pointer", fontSize: 12, fontFamily: "Georgia", fontWeight: 600 }}>
                        {b.accomType === "dayTour" ? "➕🌙 Add Overnight" : "➕☀️ Add Day Tour"}
                      </button>
                    )}
                    <button onClick={() => openEdit(b)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#f0ede8", cursor: "pointer", fontSize: 12, fontFamily: "Georgia" }}>Edit</button>
                    <button onClick={() => deleteBooking(b.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12, fontFamily: "Georgia" }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#1a2f3a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, border: "1px solid rgba(255,255,255,0.15)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#f9d77e" }}>{editBooking ? "Edit Booking" : "New Booking"}</div>

            {/* Accommodation Type */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Accommodation Type *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(ACCOM_TYPES).map(([key, at]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, accomType: key }))}
                    style={{ padding: "12px 8px", borderRadius: 10, border: `2px solid ${form.accomType === key ? at.color : "rgba(255,255,255,0.15)"}`, background: form.accomType === key ? at.color + "22" : "rgba(255,255,255,0.04)", color: form.accomType === key ? at.color : "#a0bcc8", cursor: "pointer", fontFamily: "Georgia", fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 3 }}>{at.icon}</div>
                    <div>{at.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.85 }}>{at.timeIn} – {at.timeOut}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Text fields */}
            {[
              { label: "Guest Name *",        key: "guestName", placeholder: "Full name" },
              { label: "Messenger / Contact", key: "contact",   placeholder: "FB name or phone" },
              { label: "Address",             key: "address",   placeholder: "Guest's home address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{f.label}</label>
                <input value={form[f.key]} placeholder={f.placeholder} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} style={inputStyle}/>
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>No. of Guests</label>
                <input type="number" min={1} value={form.pax} onChange={e => setForm(f => ({ ...f, pax: Number(e.target.value) }))} style={inputStyle}/>
              </div>
            </div>

            {/* Unit Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Units * {!form.exclusive && <span style={{ color: "#7ba3b0", fontWeight: 400 }}>(select one or more)</span>}</label>
                <button onClick={toggleExclusive} style={{ padding: "5px 12px", borderRadius: 8, border: `2px solid ${form.exclusive ? "#f9d77e" : "rgba(255,255,255,0.2)"}`, background: form.exclusive ? "#f9d77e22" : "transparent", color: form.exclusive ? "#f9d77e" : "#a0bcc8", cursor: "pointer", fontFamily: "Georgia", fontWeight: 700, fontSize: 11 }}>
                  🏝️ {form.exclusive ? "Exclusive ✓" : "Make Exclusive"}
                </button>
              </div>
              {form.exclusive
                ? <div style={{ background: "#f9d77e22", border: "2px solid #f9d77e55", borderRadius: 10, padding: "12px 16px", color: "#f9d77e", fontWeight: 700, fontSize: 13, textAlign: "center" }}>🏝️ Entire Resort Reserved — All 6 Cottages & 3 Rooms</div>
                : (
                  <div>
                    <div style={{ marginBottom: 6, fontSize: 11, color: "#a0bcc8" }}>Cottages</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
                      {UNITS.filter(u => u.type === "cottage").map(u => {
                        const sel = form.units.includes(u.id);
                        return <button key={u.id} onClick={() => toggleUnit(u.id)} style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${sel ? "#34d399" : "rgba(255,255,255,0.15)"}`, background: sel ? "#34d39922" : "rgba(255,255,255,0.04)", color: sel ? "#34d399" : "#a0bcc8", cursor: "pointer", fontFamily: "Georgia", fontWeight: 600, fontSize: 12 }}>🏡 {u.label}</button>;
                      })}
                    </div>
                    <div style={{ marginBottom: 6, fontSize: 11, color: "#a0bcc8" }}>Rooms</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                      {UNITS.filter(u => u.type === "room").map(u => {
                        const sel = form.units.includes(u.id);
                        return <button key={u.id} onClick={() => toggleUnit(u.id)} style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${sel ? "#34d399" : "rgba(255,255,255,0.15)"}`, background: sel ? "#34d39922" : "rgba(255,255,255,0.04)", color: sel ? "#34d399" : "#a0bcc8", cursor: "pointer", fontFamily: "Georgia", fontWeight: 600, fontSize: 12 }}>🛏 {u.label}</button>;
                      })}
                    </div>
                  </div>
                )
              }
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Notes</label>
              <input value={form.notes} placeholder="Special requests, etc." onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle}/>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={selectStyle}>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveBooking} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: "#f9d77e", color: "#1a1a1a", fontWeight: 700, cursor: "pointer", fontFamily: "Georgia", fontSize: 15 }}>
                {editBooking ? "Update" : "Add Booking"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#f0ede8", cursor: "pointer", fontFamily: "Georgia", fontSize: 15 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
