import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { askTower, buildSystemPrompt } from "./towerClient.js";

// ============================================================================
// DESIGN TOKENS
// ============================================================================
const COLORS = {
  base: "#12151C",
  surface: "#1A1F2B",
  surfaceRaised: "#212737",
  border: "#2A3142",
  borderLight: "#384058",
  text: "#E8E6E1",
  textMuted: "#8B92A5",
  textFaint: "#5B6275",
  amber: "#F0A857",
  amberDim: "#F0A85733",
  teal: "#5FB8A8",
  tealDim: "#5FB8A833",
  red: "#E2574C",
  redDim: "#E2574C2A",
  violet: "#8B85D6",
};

const FONT_DISPLAY = "'Archivo', 'Arial Narrow', sans-serif";
const FONT_BODY = "'Inter', -apple-system, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

// ============================================================================
// SEED DATA
// ============================================================================
const now = new Date();
now.setHours(14, 12, 0, 0); // simulate "current time" at 2:12pm for a believable demo

function hoursFromNow(h) {
  const d = new Date(now);
  d.setHours(d.getHours() + h);
  return d;
}

const INITIAL_TASKS = [
  {
    id: "t1",
    title: "Submit grant application — Hartwell Foundation",
    category: "deadline",
    durationMin: 90,
    due: hoursFromNow(3.8),
    status: "pending",
    importance: 5,
    notes: "Final PDF + budget sheet. Portal closes at 6pm sharp, no extensions.",
    subtasks: [
      { id: "s1", label: "Finalize budget spreadsheet", done: true },
      { id: "s2", label: "Get cosigner signature", done: false },
      { id: "s3", label: "Upload to portal", done: false },
    ],
  },
  {
    id: "t2",
    title: "Mock interview — prep with Priya",
    category: "meeting",
    durationMin: 45,
    due: hoursFromNow(1.3),
    status: "pending",
    importance: 4,
    notes: "She's blocked the time. Reschedule costs you the slot, not just the hour.",
    subtasks: [],
  },
  {
    id: "t3",
    title: "Pay electricity bill",
    category: "bill",
    durationMin: 5,
    due: hoursFromNow(28),
    status: "pending",
    importance: 2,
    notes: "Auto-pay failed last cycle — card expired.",
    subtasks: [],
  },
  {
    id: "t4",
    title: "Problem set 4 — write-up",
    category: "assignment",
    durationMin: 120,
    due: hoursFromNow(9.5),
    status: "pending",
    importance: 4,
    notes: "3 of 5 problems done from Tuesday. Two left, one is the hard one.",
    subtasks: [
      { id: "s4", label: "Problem 4 (proof)", done: false },
      { id: "s5", label: "Problem 5 (computation)", done: false },
    ],
  },
  {
    id: "t5",
    title: "Reply to landlord re: lease renewal",
    category: "email",
    durationMin: 10,
    due: hoursFromNow(20),
    status: "pending",
    importance: 3,
    notes: "Needs a decision, not just an acknowledgment.",
    subtasks: [],
  },
  {
    id: "t6",
    title: "Morning run — 5k",
    category: "habit",
    durationMin: 30,
    due: hoursFromNow(-2),
    status: "done",
    importance: 1,
    notes: "Streak: 6 days",
    subtasks: [],
  },
];

const CATEGORY_META = {
  deadline: { label: "Deadline", color: COLORS.red, icon: "flag" },
  meeting: { label: "Meeting", color: COLORS.violet, icon: "users" },
  assignment: { label: "Assignment", color: COLORS.amber, icon: "file-text" },
  bill: { label: "Bill", color: COLORS.teal, icon: "receipt" },
  email: { label: "Email", color: COLORS.textMuted, icon: "mail" },
  habit: { label: "Habit", color: COLORS.teal, icon: "repeat" },
};

// ============================================================================
// AI REASONING ENGINE (deterministic, transparent — not a black box)
// ============================================================================
function hoursUntil(date) {
  return (date.getTime() - now.getTime()) / 36e5;
}

function urgencyScore(task) {
  if (task.status === "done") return -1;
  const hrs = hoursUntil(task.due);
  const buffer = hrs - task.durationMin / 60;
  // Lower buffer = more urgent. Weight by importance.
  const urgency = Math.max(0, 10 - buffer) * (task.importance / 3);
  return urgency;
}

function priorityRank(tasks) {
  return [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => urgencyScore(b) - urgencyScore(a));
}

function reasonFor(task, rank, allTasks) {
  const hrs = hoursUntil(task.due);
  const buffer = hrs - task.durationMin / 60;
  if (buffer < 0) return "Past the point where this fits before it's due. Needs to start now.";
  if (rank === 0) {
    if (buffer < 1) return `Tightest margin of anything open — ${fmtHrs(buffer)} of slack once you start.`;
    return `Highest combined urgency and importance right now.`;
  }
  if (task.category === "meeting") return "Fixed time, can't be compressed — treat the start time as the deadline.";
  if (buffer < 2) return `Only ${fmtHrs(buffer)} of slack left after the time it'll take.`;
  if (task.importance >= 4) return "High stakes, but more runway than the items above.";
  return "Lower urgency for now — there's room to move this later today.";
}

function fmtHrs(h) {
  if (h < 0) return "0h";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtCountdown(date) {
  const ms = date.getTime() - now.getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 0) return "overdue";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Generates the AI's proactive nudge for the top task
function generateNudge(topTask, allOpen) {
  if (!topTask) return null;
  const buffer = hoursUntil(topTask.due) - topTask.durationMin / 60;
  const conflicts = allOpen.filter(
    (t) => t.id !== topTask.id && Math.abs(hoursUntil(t.due) - hoursUntil(topTask.due)) < 1.5
  );
  if (buffer < 1) {
    return {
      tone: "urgent",
      message: `"${shorten(topTask.title)}" needs ${topTask.durationMin} min and is due in ${fmtCountdown(topTask.due)}. Start now to land it with margin.`,
      action: "Start now",
    };
  }
  if (conflicts.length > 0) {
    return {
      tone: "warn",
      message: `"${shorten(topTask.title)}" and "${shorten(conflicts[0].title)}" both land in the same window. Recommend doing this one first — it has less slack.`,
      action: "Lock this order",
    };
  }
  return {
    tone: "info",
    message: `You have ${fmtHrs(buffer)} of slack on "${shorten(topTask.title)}" if you start within the hour.`,
    action: "Schedule it",
  };
}

function shorten(s, n = 38) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ============================================================================
// ICONS (minimal inline SVG set — no external deps)
// ============================================================================
const Icon = ({ name, size = 16, color = "currentColor", style }) => {
  const paths = {
    flag: "M5 3v18M5 4h11l-2.5 4L16 12H5",
    users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M17 11a3 3 0 1 0 0-6M21 21v-1a5 5 0 0 0-3.5-4.8",
    "file-text": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9 13h6M9 17h6M9 9h1",
    receipt: "M5 2v20l2-1.5L9 22l2-1.5L13 22l2-1.5L17 22l2-1.5L21 22V2H5zM9 7h6M9 11h6M9 15h3",
    mail: "M3 5h18v14H3V5zM3 5l9 7 9-7",
    repeat: "M17 2l4 4-4 4M3 12v-2a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 12v2a4 4 0 0 1-4 4H3",
    check: "M20 6L9 17l-5-5",
    plus: "M12 5v14M5 12h14",
    chevronDown: "M6 9l6 6 6-6",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    zap: "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
    target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 12a.5.5 0 1 0 0-1",
    mic: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
    x: "M18 6L6 18M6 6l12 12",
    play: "M5 3l16 9-16 9V3z",
    trendingUp: "M3 17l6-6 4 4 8-8M15 7h6v6",
    calendar: "M3 4h18v18H3V4zM16 2v4M8 2v4M3 10h18",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    alertCircle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={paths[name] || paths.flag} />
    </svg>
  );
};

// ============================================================================
// SPLIT-FLAP DIGIT — signature micro-interaction for status changes
// ============================================================================
const FlapStatus = ({ status }) => {
  const labels = { pending: "SCHEDULED", boarding: "BOARDING", done: "DEPARTED", missed: "MISSED" };
  const colorMap = { pending: COLORS.textMuted, boarding: COLORS.amber, done: COLORS.teal, missed: COLORS.red };
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10.5,
        letterSpacing: "0.12em",
        color: colorMap[status],
        background: COLORS.surfaceRaised,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 3,
        padding: "3px 7px",
        display: "inline-block",
      }}
    >
      {labels[status]}
    </span>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================
export default function App() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [tab, setTab] = useState("today");
  const [selectedTask, setSelectedTask] = useState(null);
  const [streak, setStreak] = useState(6);
  const [showAddTask, setShowAddTask] = useState(false);
  const [tickFlash, setTickFlash] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const ranked = useMemo(() => priorityRank(tasks), [tasks]);
  const topTask = ranked[0] || null;
  const nudge = useMemo(() => generateNudge(topTask, openTasks), [topTask, openTasks]);

  const showToast = useCallback((msg, tone = "info") => {
    setToast({ msg, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const markDone = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
    setTickFlash(true);
    setTimeout(() => setTickFlash(false), 600);
    showToast("Marked complete — nice work.", "success");
  };

  const toggleSubtask = (taskId, subId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }
          : t
      )
    );
  };

  const addTask = (newTask) => {
    setTasks((prev) => [...prev, { ...newTask, id: "t" + Date.now(), status: "pending", subtasks: [] }]);
    setShowAddTask(false);
    showToast("Added — slotted into today's priority order.", "info");
  };

  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        background: COLORS.base,
        color: COLORS.text,
        minHeight: "100vh",
        width: "100%",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        button { font-family: inherit; cursor: pointer; }
        @keyframes flashGreen { 0% { background: ${COLORS.tealDim}; } 100% { background: transparent; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes flapIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .flash { animation: flashGreen 0.6s ease-out; }
        .slide-up { animation: slideUp 0.35s ease-out; }
        .task-row:hover { background: ${COLORS.surfaceRaised} !important; }
        @media (max-width: 760px) {
          .main-grid { grid-template-columns: 1fr !important; }
          .tower-panel { order: -1; }
        }
      `}</style>

      <TopBar tab={tab} setTab={setTab} streak={streak} />

      <div
        className="main-grid"
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 24px 80px",
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 28,
        }}
      >
        <div>
          {tab === "today" && (
            <TodayView
              tasks={tasks}
              ranked={ranked}
              onMarkDone={markDone}
              onSelect={setSelectedTask}
              tickFlash={tickFlash}
              onAdd={() => setShowAddTask(true)}
            />
          )}
          {tab === "priorities" && <PrioritiesView ranked={ranked} onSelect={setSelectedTask} />}
          {tab === "habits" && <HabitsView streak={streak} setStreak={setStreak} showToast={showToast} />}
        </div>

        <div className="tower-panel">
          <TowerPanel
            nudge={nudge}
            topTask={topTask}
            voiceListening={voiceListening}
            setVoiceListening={setVoiceListening}
            showToast={showToast}
            openCount={openTasks.length}
            tasks={tasks}
          />
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={tasks.find((t) => t.id === selectedTask)}
          rank={ranked.findIndex((t) => t.id === selectedTask)}
          allOpen={openTasks}
          onClose={() => setSelectedTask(null)}
          onMarkDone={markDone}
          onToggleSubtask={toggleSubtask}
        />
      )}

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onAdd={addTask} />}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}

// ============================================================================
// TOP BAR
// ============================================================================
function TopBar({ tab, setTab, streak }) {
  const tabs = [
    { id: "today", label: "Today" },
    { id: "priorities", label: "Priorities" },
    { id: "habits", label: "Habits" },
  ];
  return (
    <div
      style={{
        borderBottom: `1px solid ${COLORS.border}`,
        position: "sticky",
        top: 0,
        background: COLORS.base,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "18px 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: COLORS.amber,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="zap" size={17} color={COLORS.base} />
          </div>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "-0.01em",
            }}
          >
            DEPARTURES
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textMuted, fontSize: 13 }}>
            <Icon name="trendingUp" size={14} color={COLORS.teal} />
            <span>{streak} day streak</span>
          </div>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: COLORS.violet,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.base,
            }}
          >
            JM
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4, marginTop: 14 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 4px",
              marginRight: 22,
              fontSize: 14.5,
              fontWeight: 500,
              color: tab === t.id ? COLORS.text : COLORS.textMuted,
              borderBottom: tab === t.id ? `2px solid ${COLORS.amber}` : "2px solid transparent",
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TODAY VIEW — the timeline-as-physical-time spine
// ============================================================================
function TodayView({ tasks, ranked, onMarkDone, onSelect, tickFlash, onAdd }) {
  const dayStart = 7; // 7am
  const dayEnd = 23; // 11pm
  const totalSpan = dayEnd - dayStart;
  const nowPct = Math.min(100, Math.max(0, ((now.getHours() + now.getMinutes() / 60 - dayStart) / totalSpan) * 100));

  const sorted = [...tasks].sort((a, b) => a.due - b.due);

  return (
    <div className="slide-up">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
          {now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
        </h1>
        <button
          onClick={onAdd}
          style={{
            background: COLORS.amber,
            color: COLORS.base,
            border: "none",
            borderRadius: 7,
            padding: "8px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="plus" size={15} color={COLORS.base} />
          Add task
        </button>
      </div>
      <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 0, marginBottom: 28 }}>
        {ranked.length} open · current time {fmtTime(now)}
      </p>

      <div style={{ position: "relative", paddingLeft: 2 }}>
        {/* Now line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${nowPct}%`,
            height: 1,
            background: COLORS.amber,
            zIndex: 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -2,
              top: -4,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: COLORS.amber,
              boxShadow: `0 0 0 3px ${COLORS.amberDim}`,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sorted.map((task) => {
            const rank = ranked.findIndex((t) => t.id === task.id);
            return (
              <TimelineRow
                key={task.id}
                task={task}
                rank={rank}
                onMarkDone={onMarkDone}
                onSelect={onSelect}
                tickFlash={tickFlash}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ task, rank, onMarkDone, onSelect, tickFlash }) {
  const meta = CATEGORY_META[task.category];
  const isDone = task.status === "done";
  const isPast = hoursUntil(task.due) < 0 && !isDone;
  const isTopUrgent = rank === 0 && !isDone;
  const countdown = fmtCountdown(task.due);

  return (
    <div
      className={`task-row ${isDone ? "flash" : ""}`}
      onClick={() => onSelect(task.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 12px",
        borderRadius: 8,
        cursor: "pointer",
        opacity: isDone ? 0.55 : 1,
        background: isTopUrgent ? COLORS.amberDim : "transparent",
        border: isTopUrgent ? `1px solid ${COLORS.amber}55` : "1px solid transparent",
      }}
    >
      <div style={{ width: 64, flexShrink: 0, fontFamily: FONT_MONO, fontSize: 13, color: COLORS.textMuted }}>
        {fmtTime(task.due)}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isDone) onMarkDone(task.id);
        }}
        aria-label={isDone ? "Completed" : "Mark complete"}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `1.5px solid ${isDone ? COLORS.teal : COLORS.borderLight}`,
          background: isDone ? COLORS.teal : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isDone && <Icon name="check" size={12} color={COLORS.base} />}
      </button>

      <div style={{ width: 4, height: 30, borderRadius: 2, background: meta.color, flexShrink: 0, opacity: 0.7 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 500,
            textDecoration: isDone ? "line-through" : "none",
            color: isDone ? COLORS.textMuted : COLORS.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {task.title}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>
          {meta.label} · {task.durationMin} min
        </div>
      </div>

      {!isDone && (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            fontWeight: 500,
            color: isPast ? COLORS.red : isTopUrgent ? COLORS.amber : COLORS.textMuted,
            flexShrink: 0,
            minWidth: 56,
            textAlign: "right",
          }}
        >
          {isPast ? "overdue" : countdown}
        </div>
      )}

      {isDone && <FlapStatus status="done" />}
    </div>
  );
}

// ============================================================================
// TOWER PANEL — the AI's visible reasoning + nudges
// ============================================================================
function TowerPanel({ nudge, topTask, voiceListening, setVoiceListening, showToast, openCount, tasks }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const systemPrompt = buildSystemPrompt(tasks, now);
      const reply = await askTower(nextMessages, systemPrompt);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err.message || "Couldn't reach Tower. Check the proxy URL in src/config.js.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 18,
        position: "sticky",
        top: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: COLORS.teal,
            boxShadow: `0 0 0 3px ${COLORS.tealDim}`,
            animation: "pulse 2s infinite",
          }}
        />
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: COLORS.textMuted }}>
          TOWER
        </span>
      </div>

      {!chatOpen && (
        <>
          {nudge ? (
            <div
              key={nudge.message}
              className="slide-up"
              style={{
                background: nudge.tone === "urgent" ? COLORS.redDim : nudge.tone === "warn" ? COLORS.amberDim : COLORS.surfaceRaised,
                border: `1px solid ${nudge.tone === "urgent" ? COLORS.red + "55" : nudge.tone === "warn" ? COLORS.amber + "55" : COLORS.border}`,
                borderRadius: 9,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0, color: COLORS.text }}>{nudge.message}</p>
              <button
                onClick={() => showToast(`${nudge.action} — confirmed.`, "success")}
                style={{
                  marginTop: 10,
                  background: "transparent",
                  border: `1px solid ${COLORS.borderLight}`,
                  color: COLORS.text,
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                {nudge.action} →
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 13.5, color: COLORS.textMuted, marginBottom: 14 }}>
              Nothing urgent right now. Clear skies.
            </p>
          )}

          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 8, letterSpacing: "0.04em" }}>
              WHY THIS ORDER
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ReasonLine icon="target" text={`Ranked by urgency × importance, recalculated live`} />
              <ReasonLine icon="clock" text={`${openCount} open items in today's window`} />
              <ReasonLine icon="calendar" text="Fixed-time meetings always outrank flexible tasks" />
            </div>
          </div>

          <button
            onClick={() => setChatOpen(true)}
            style={{
              width: "100%",
              background: COLORS.surfaceRaised,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              borderRadius: 8,
              padding: "11px 14px",
              fontSize: 13.5,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Icon name="mic" size={15} color={COLORS.text} />
            Ask Tower to replan
          </button>
        </>
      )}

      {chatOpen && (
        <div className="slide-up">
          <div
            ref={scrollRef}
            style={{
              maxHeight: 320,
              minHeight: 120,
              overflowY: "auto",
              marginBottom: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <p style={{ fontSize: 12.5, color: COLORS.textFaint, lineHeight: 1.5 }}>
                Try: "I'm sick today, what should I push?" or "I only have an hour before my next call — what do I actually do?"
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  background: m.role === "user" ? COLORS.amberDim : COLORS.surfaceRaised,
                  border: `1px solid ${m.role === "user" ? COLORS.amber + "44" : COLORS.border}`,
                  borderRadius: 8,
                  padding: "8px 11px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: COLORS.text,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  fontSize: 12.5,
                  color: COLORS.textMuted,
                  padding: "8px 11px",
                }}
              >
                Tower is thinking…
              </div>
            )}
            {error && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                  fontSize: 12,
                  color: COLORS.red,
                  background: COLORS.redDim,
                  border: `1px solid ${COLORS.red}44`,
                  borderRadius: 7,
                  padding: "8px 10px",
                }}
              >
                <Icon name="alertCircle" size={13} color={COLORS.red} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask Tower anything…"
              style={{
                flex: 1,
                background: COLORS.surfaceRaised,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                borderRadius: 7,
                padding: "9px 11px",
                fontSize: 13,
                fontFamily: FONT_BODY,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() ? COLORS.amber : COLORS.border,
                border: "none",
                borderRadius: 7,
                width: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="send" size={14} color={input.trim() ? COLORS.base : COLORS.textFaint} />
            </button>
          </div>

          <button
            onClick={() => setChatOpen(false)}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              color: COLORS.textFaint,
              fontSize: 12,
              marginTop: 10,
              padding: 4,
            }}
          >
            ← Back to nudges
          </button>
        </div>
      )}
    </div>
  );
}

function ReasonLine({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <Icon name={icon} size={13} color={COLORS.textFaint} style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ============================================================================
// PRIORITIES VIEW — ranked list with explicit AI reasoning per item
// ============================================================================
function PrioritiesView({ ranked, onSelect }) {
  return (
    <div className="slide-up">
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
        Priority order
      </h1>
      <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 0, marginBottom: 28 }}>
        Recalculated continuously from urgency, importance, and fixed commitments.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ranked.map((task, i) => {
          const meta = CATEGORY_META[task.category];
          const reason = reasonFor(task, i, ranked);
          return (
            <div
              key={task.id}
              onClick={() => onSelect(task.id)}
              style={{
                background: COLORS.surface,
                border: `1px solid ${i === 0 ? COLORS.amber + "66" : COLORS.border}`,
                borderRadius: 10,
                padding: 16,
                cursor: "pointer",
                display: "flex",
                gap: 14,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 20,
                  fontWeight: 800,
                  color: i === 0 ? COLORS.amber : COLORS.textFaint,
                  width: 28,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{task.title}</span>
                </div>
                <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 8 }}>
                  {meta.label} · due {fmtTime(task.due)} · {task.durationMin} min
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: COLORS.text,
                    background: COLORS.surfaceRaised,
                    borderRadius: 6,
                    padding: "7px 10px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <Icon name="zap" size={12} color={COLORS.amber} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{reason}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// HABITS VIEW
// ============================================================================
function HabitsView({ streak, setStreak, showToast }) {
  const [habits, setHabits] = useState([
    { id: "h1", label: "Morning run", done: true, streak: 6 },
    { id: "h2", label: "Inbox zero by noon", done: false, streak: 3 },
    { id: "h3", label: "No phone after 11pm", done: false, streak: 11 },
  ]);

  const toggle = (id) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const done = !h.done;
        return { ...h, done, streak: done ? h.streak + 1 : Math.max(0, h.streak - 1) };
      })
    );
  };

  return (
    <div className="slide-up">
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
        Habits
      </h1>
      <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 0, marginBottom: 28 }}>
        Small recurring commitments. Consistency tracked, not graded.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {habits.map((h) => (
          <div
            key={h.id}
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <button
              onClick={() => toggle(h.id)}
              aria-label={h.done ? "Done today" : "Mark done today"}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: `1.5px solid ${h.done ? COLORS.teal : COLORS.borderLight}`,
                background: h.done ? COLORS.teal : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {h.done && <Icon name="check" size={13} color={COLORS.base} />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500 }}>{h.label}</div>
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12.5,
                color: h.streak >= 7 ? COLORS.teal : COLORS.textMuted,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="trendingUp" size={13} color={h.streak >= 7 ? COLORS.teal : COLORS.textMuted} />
              {h.streak}d
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
        }}
      >
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 10, letterSpacing: "0.04em" }}>
          TOWER'S OBSERVATION
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: COLORS.text }}>
          "Inbox zero by noon" has the shortest streak and keeps slipping on days with morning meetings. Worth moving it to a fixed 15-minute block before your first call.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TASK DETAIL MODAL
// ============================================================================
function TaskDetailModal({ task, rank, allOpen, onClose, onMarkDone, onToggleSubtask }) {
  if (!task) return null;
  const meta = CATEGORY_META[task.category];
  const reason = task.status !== "done" ? reasonFor(task, rank, allOpen) : null;
  const buffer = hoursUntil(task.due) - task.durationMin / 60;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000099",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          padding: 26,
          maxWidth: 480,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: meta.color,
              background: meta.color + "22",
              padding: "4px 9px",
              borderRadius: 5,
              letterSpacing: "0.03em",
            }}
          >
            {meta.label.toUpperCase()}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", padding: 4 }} aria-label="Close">
            <Icon name="x" size={18} color={COLORS.textMuted} />
          </button>
        </div>

        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.3 }}>
          {task.title}
        </h2>

        <div style={{ display: "flex", gap: 16, fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
          <span>Due {fmtTime(task.due)}</span>
          <span>{task.durationMin} min</span>
          {task.status !== "done" && (
            <span style={{ color: buffer < 1 ? COLORS.red : COLORS.text }}>{fmtHrs(Math.max(0, buffer))} slack</span>
          )}
        </div>

        {task.notes && (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: COLORS.text, marginBottom: 18 }}>{task.notes}</p>
        )}

        {reason && (
          <div
            style={{
              background: COLORS.surfaceRaised,
              borderRadius: 8,
              padding: 12,
              marginBottom: 18,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <Icon name="zap" size={13} color={COLORS.amber} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.text }}>{reason}</span>
          </div>
        )}

        {task.subtasks.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 8, letterSpacing: "0.04em" }}>
              STEPS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {task.subtasks.map((s) => (
                <label
                  key={s.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => onToggleSubtask(task.id, s.id)}
                    style={{ width: 16, height: 16, accentColor: COLORS.teal }}
                  />
                  <span style={{ textDecoration: s.done ? "line-through" : "none", color: s.done ? COLORS.textMuted : COLORS.text }}>
                    {s.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {task.status !== "done" ? (
          <button
            onClick={() => {
              onMarkDone(task.id);
              onClose();
            }}
            style={{
              width: "100%",
              background: COLORS.teal,
              border: "none",
              color: COLORS.base,
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Icon name="check" size={16} color={COLORS.base} />
            Mark complete
          </button>
        ) : (
          <FlapStatus status="done" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ADD TASK MODAL
// ============================================================================
function AddTaskModal({ onClose, onAdd }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("assignment");
  const [duration, setDuration] = useState(30);
  const [hoursOut, setHoursOut] = useState(4);

  const inputStyle = {
    width: "100%",
    background: COLORS.surfaceRaised,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.text,
    borderRadius: 7,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: FONT_BODY,
    marginBottom: 14,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000099",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          padding: 26,
          maxWidth: 420,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, margin: 0 }}>New task</h2>
          <button onClick={onClose} style={{ background: "none", border: "none" }} aria-label="Close">
            <Icon name="x" size={18} color={COLORS.textMuted} />
          </button>
        </div>

        <label style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6, display: "block" }}>What needs doing</label>
        <input
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Finish lab report"
          autoFocus
        />

        <label style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6, display: "block" }}>Category</label>
        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6, display: "block" }}>
              Duration (min)
            </label>
            <input
              type="number"
              style={inputStyle}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={5}
              step={5}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6, display: "block" }}>
              Due in (hours)
            </label>
            <input
              type="number"
              style={inputStyle}
              value={hoursOut}
              onChange={(e) => setHoursOut(Number(e.target.value))}
              min={0.5}
              step={0.5}
            />
          </div>
        </div>

        <button
          onClick={() => {
            if (!title.trim()) return;
            onAdd({
              title: title.trim(),
              category,
              durationMin: duration,
              due: hoursFromNow(hoursOut),
              importance: 3,
              notes: "",
            });
          }}
          disabled={!title.trim()}
          style={{
            width: "100%",
            background: title.trim() ? COLORS.amber : COLORS.border,
            border: "none",
            color: title.trim() ? COLORS.base : COLORS.textFaint,
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 14,
            fontWeight: 600,
            marginTop: 6,
          }}
        >
          Add to today
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TOAST
// ============================================================================
function Toast({ msg, tone }) {
  return (
    <div
      className="slide-up"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: COLORS.surfaceRaised,
        border: `1px solid ${tone === "success" ? COLORS.teal + "66" : COLORS.border}`,
        borderRadius: 9,
        padding: "11px 18px",
        fontSize: 13.5,
        color: COLORS.text,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 200,
        boxShadow: "0 8px 24px #00000055",
      }}
    >
      {tone === "success" && <Icon name="check" size={14} color={COLORS.teal} />}
      {msg}
    </div>
  );
}
