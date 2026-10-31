import { useState } from 'react';
import {
  DEMO_CATEGORIES,
  type DemoCategory,
  filterDemoFeatures,
  PERSISTENCE_LABELS,
} from '../demo-catalog';

export function DemoCatalogPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DemoCategory | 'all'>('all');
  const features = filterDemoFeatures(query, category);
  return (
    <main className="pg-page" data-testid="pg-index">
      <h1>功能示範目錄</h1>
      <p className="pg-lead">
        依功能找範例，進入後可查看操作步驟與預期結果。使用上方設定列切換語系與外觀。
      </p>
      <div className="pg-row pg-catalog-filters">
        <label className="pg-catalog-search">
          搜尋功能
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="輸入名稱或功能，例如遠端、表單、圖表"
          />
        </label>
        <label>
          功能分類
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as DemoCategory | 'all')}
          >
            <option value="all">全部分類</option>
            {Object.entries(DEMO_CATEGORIES).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setCategory('all');
          }}
        >
          清除篩選
        </button>
      </div>
      <p role="status">顯示 {features.length} 個示範</p>
      {features.length === 0 && <p>找不到符合條件的示範。</p>}
      {Object.entries(DEMO_CATEGORIES).map(([id, title]) => {
        const entries = features.filter((feature) => feature.category === id);
        return (
          entries.length > 0 && (
            <section className="pg-section" key={id} aria-label={title}>
              <h2>{title}</h2>
              <ul className="pg-index pg-catalog-grid">
                {entries.map((feature) => (
                  <li key={feature.id}>
                    <a href={feature.href}>{feature.title}</a>
                    <p>{feature.summary}</p>
                    <small>{PERSISTENCE_LABELS[feature.persistence]}</small>
                  </li>
                ))}
              </ul>
            </section>
          )
        );
      })}
    </main>
  );
}
