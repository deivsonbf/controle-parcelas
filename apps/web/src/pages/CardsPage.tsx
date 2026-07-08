import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Card, User } from '../types/api';
import { useToast } from '../contexts/ToastContext';
import { ImagePlus, Pencil, X } from 'lucide-react';

const emptyForm = { name: '', lastFour: '', ownerName: '', ownerUserId: '', imageUrl: '', closingDay: 10, dueDay: 20, active: true };

export function CardsPage() {
  const toast = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<Card[]>('/cards').then(setCards).catch((error) => {
      toast.error('Erro ao carregar cartoes', error instanceof Error ? error.message : undefined);
    });
    api<User[]>('/users').then(setUsers).catch((error) => {
      toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
    });
  }

  useEffect(load, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api(editingId ? `/cards/${editingId}` : '/cards', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          ownerUserId: form.ownerUserId || null,
          imageUrl: form.imageUrl || null
        })
      });
      toast.success(editingId ? 'Cartao atualizado' : 'Cartao cadastrado', `${form.name} foi salvo.`);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(`Erro ao ${editingId ? 'atualizar' : 'cadastrar'} cartao`, error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function editCard(item: Card) {
    setEditingId(item.id);
    setForm({ name: item.name, lastFour: item.lastFour, ownerName: item.ownerName, ownerUserId: item.ownerUserId ?? '', imageUrl: item.imageUrl ?? '', closingDay: item.closingDay, dueDay: item.dueDay, active: item.active });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function generateCardImage() {
    const title = escapeSvgText(form.name || 'Cartao');
    const owner = escapeSvgText(form.ownerName || 'Titular');
    const final = escapeSvgText(form.lastFour || '0000');
    const [startColor, endColor] = pickCardColors(form.name || form.ownerName || final);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${startColor}"/><stop offset="1" stop-color="${endColor}"/></linearGradient></defs><rect width="720" height="440" rx="34" fill="url(#bg)"/><circle cx="610" cy="88" r="82" fill="rgba(255,255,255,.14)"/><circle cx="536" cy="104" r="58" fill="rgba(255,255,255,.10)"/><rect x="56" y="132" width="86" height="66" rx="12" fill="rgba(255,255,255,.72)"/><rect x="72" y="150" width="54" height="12" rx="6" fill="rgba(15,23,42,.28)"/><text x="56" y="76" fill="white" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">${title}</text><text x="56" y="284" fill="white" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="5">**** **** **** ${final}</text><text x="56" y="356" fill="rgba(255,255,255,.82)" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="600">${owner}</text><text x="574" y="356" fill="rgba(255,255,255,.82)" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="700">CREDITO</text></svg>`;
    setForm({ ...form, imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}` });
    toast.success('Imagem gerada', 'A imagem do cartao foi criada no formulario.');
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Cartoes</h1>
          <p>Configure fechamento, vencimento, titular e identidade visual dos cartoes.</p>
        </div>
      </div>
      <form className="panel form-grid" onSubmit={submit}>
        <input placeholder="Nome do cartao" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Ultimos 4 digitos" maxLength={4} value={form.lastFour} onChange={(e) => setForm({ ...form, lastFour: e.target.value })} />
        <input placeholder="Titular" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
        <div className="card-image-field">
          <input type="url" placeholder="URL da imagem do cartao" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <button className="secondary-button" type="button" onClick={generateCardImage}><ImagePlus size={17} /> Gerar imagem</button>
        </div>
        {form.imageUrl && <img className="card-preview" src={form.imageUrl} alt="Previa do cartao" />}
        <select
          value={form.ownerUserId}
          onChange={(e) => {
            const owner = users.find((item) => item.id === e.target.value);
            setForm({ ...form, ownerUserId: e.target.value, ownerName: owner?.name ?? form.ownerName });
          }}
        >
          <option value="">Dono no sistema</option>
          {users.filter((item) => !item.cardBuyerOnly).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input type="number" min={1} max={31} value={form.closingDay} onChange={(e) => setForm({ ...form, closingDay: Number(e.target.value) })} />
        <input type="number" min={1} max={31} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: Number(e.target.value) })} />
        <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Ativo</label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Cadastrar cartao'}
        </button>
        {editingId && <button className="secondary-button" type="button" onClick={cancelEdit}><X size={17} /> Cancelar</button>}
      </form>
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Imagem</th><th>Cartao</th><th>Final</th><th>Titular</th><th>Dono no sistema</th><th>Fechamento</th><th>Vencimento</th><th>Status</th><th aria-label="Acoes" /></tr></thead>
          <tbody>{cards.map((item) => <tr key={item.id}><td>{item.imageUrl ? <img className="card-thumb" src={item.imageUrl} alt={`Cartao ${item.name}`} /> : <span className="empty-state">Sem imagem</span>}</td><td>{item.name}</td><td>**** {item.lastFour}</td><td>{item.ownerName}</td><td>{item.ownerUserName ?? 'Nao vinculado'}</td><td>Dia {item.closingDay}</td><td>Dia {item.dueDay}</td><td><span className={`status-pill ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Ativo' : 'Inativo'}</span></td><td className="actions-cell"><button className="icon-button" type="button" title="Editar cartao" aria-label={`Editar ${item.name}`} onClick={() => editCard(item)}><Pencil size={17} /></button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function escapeSvgText(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
}

function pickCardColors(seed: string) {
  const fallback: [string, string] = ['#111827', '#2563eb'];
  const palettes: Array<[string, string]> = [
    fallback,
    ['#0f766e', '#0f172a'],
    ['#7c2d12', '#be123c'],
    ['#312e81', '#0891b2'],
    ['#365314', '#0f766e'],
    ['#1f2937', '#9333ea']
  ];
  const index = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index] ?? fallback;
}
