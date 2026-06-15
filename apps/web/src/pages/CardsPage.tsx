import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Card } from '../types/api';
import { useToast } from '../contexts/ToastContext';

export function CardsPage() {
  const toast = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [form, setForm] = useState({ name: '', lastFour: '', ownerName: '', closingDay: 10, dueDay: 20, active: true });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<Card[]>('/cards').then(setCards).catch((error) => {
      toast.error('Erro ao carregar cartoes', error instanceof Error ? error.message : undefined);
    });
  }

  useEffect(load, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api('/cards', { method: 'POST', body: JSON.stringify(form) });
      toast.success('Cartao cadastrado', `${form.name} foi adicionado.`);
      setForm({ name: '', lastFour: '', ownerName: '', closingDay: 10, dueDay: 20, active: true });
      load();
    } catch (error) {
      toast.error('Erro ao cadastrar cartao', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page">
      <div className="page-header"><div><h1>Cartoes</h1></div></div>
      <form className="panel form-grid" onSubmit={submit}>
        <input placeholder="Nome do cartao" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Ultimos 4 digitos" maxLength={4} value={form.lastFour} onChange={(e) => setForm({ ...form, lastFour: e.target.value })} />
        <input placeholder="Titular" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
        <input type="number" min={1} max={31} value={form.closingDay} onChange={(e) => setForm({ ...form, closingDay: Number(e.target.value) })} />
        <input type="number" min={1} max={31} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: Number(e.target.value) })} />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Cadastrando...' : 'Cadastrar cartao'}
        </button>
      </form>
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Cartao</th><th>Final</th><th>Titular</th><th>Fechamento</th><th>Vencimento</th></tr></thead>
          <tbody>{cards.map((item) => <tr key={item.id}><td>{item.name}</td><td>**** {item.lastFour}</td><td>{item.ownerName}</td><td>Dia {item.closingDay}</td><td>Dia {item.dueDay}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
