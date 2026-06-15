import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Category } from '../types/api';
import { useToast } from '../contexts/ToastContext';

export function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: '', color: '#2563eb' });
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
      await api('/categories', { method: 'POST', body: JSON.stringify(form) });
      toast.success('Categoria cadastrada', `${form.name} foi adicionada.`);
      setForm({ name: '', color: '#2563eb' });
      load();
    } catch (error) {
      toast.error('Erro ao cadastrar categoria', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page">
      <div className="page-header"><div><h1>Categorias</h1></div></div>
      <form className="panel form-grid" onSubmit={submit}>
        <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Cadastrando...' : 'Cadastrar categoria'}
        </button>
      </form>
      <div className="category-grid">
        {categories.map((item) => (
          <div className="category-card" key={item.id}>
            <span style={{ background: item.color }} />
            <strong>{item.name}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
