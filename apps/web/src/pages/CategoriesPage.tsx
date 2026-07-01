import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Category } from '../types/api';
import { useToast } from '../contexts/ToastContext';
import { Pencil, X } from 'lucide-react';

const emptyForm = { name: '', color: '#2563eb' };

export function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<Category[]>('/categories').then(setCategories).catch((error) => {
      toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
    });
  }

  useEffect(load, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api(editingId ? `/categories/${editingId}` : '/categories', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(form) });
      toast.success(editingId ? 'Categoria atualizada' : 'Categoria cadastrada', `${form.name} foi salva.`);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(`Erro ao ${editingId ? 'atualizar' : 'cadastrar'} categoria`, error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function editCategory(item: Category) { setEditingId(item.id); setForm({ name: item.name, color: item.color }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  return (
    <section className="page">
      <div className="page-header"><div><h1>Categorias</h1></div></div>
      <form className="panel form-grid" onSubmit={submit}>
        <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Cadastrar categoria'}
        </button>
        {editingId && <button className="secondary-button" type="button" onClick={cancelEdit}><X size={17} /> Cancelar</button>}
      </form>
      <div className="category-grid">
        {categories.map((item) => (
          <div className="category-card" key={item.id}>
            <span style={{ background: item.color }} />
            <strong>{item.name}</strong>
            <button className="icon-button category-edit-button" type="button" title="Editar categoria" aria-label={`Editar ${item.name}`} onClick={() => editCategory(item)}><Pencil size={17} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
