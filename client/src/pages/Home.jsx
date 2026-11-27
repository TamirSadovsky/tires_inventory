import { useNavigate } from "react-router-dom"

const ACTIONS = [
  { id: "count", title: "ספירת מלאי", text: "סריקה וקליטת כמות", enabled: true, to: "/count" },
  { id: "in", title: "קליטה למלאי", text: "סריקה והכנסת כמות", enabled: true, to: "/in" },
  { id: "out", title: "הוצאה ממלאי", text: "סריקה והוצאת כמות", enabled: true, to: "/out" },
  { id: "reports", title: "דוחות מלאי", text: "יהיה זמין בשלב הבא", enabled: false },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <section className="home">
      <div className="page-intro">
        <p className="eyebrow">מסך הבית</p>
        <h1>קליטת וניהול המלאי</h1>
        <p className="lead">ספירה, קליטה והוצאה פתוחות. דוחות מלאי ייפתחו אחר כך.</p>
      </div>
      <div className="action-grid">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className={action.enabled ? "action-card is-live" : "action-card"}
            disabled={!action.enabled}
            onClick={() => action.to && navigate(action.to)}
          >
            <strong>{action.title}</strong>
            <span>{action.text}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
