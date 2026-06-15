export function StatCard({ label, value, tone = 'blue' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
