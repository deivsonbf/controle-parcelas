export function StatCard({ label, value, tone = 'blue' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-card-marker" aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
