import React, { useState } from 'react';
import { Sparkles, Plus, Search, Tag, Check, Flame } from 'lucide-react';
import { CommentItem } from '../data/comments';
import { soundEffects } from '../services/soundEffects';

interface CommentDeckProps {
  comments: CommentItem[];
  activeComment: string;
  onSelectComment: (comment: CommentItem) => void;
  onAddComment: (newComment: CommentItem) => void;
}

export const CommentDeck: React.FC<CommentDeckProps> = ({
  comments,
  activeComment,
  onSelectComment,
  onAddComment,
}) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [newText, setNewText] = useState<string>('');
  const [newCategory, setNewCategory] = useState<CommentItem['category']>('SWAG ALERT');
  const [newLang, setNewLang] = useState<'English'>('English');

  const categories = ['ALL', 'SWAG ALERT', 'SURPRISE!', 'SMILE LEGEND', 'HERO MODE', 'ROYALTY'];

  const filteredComments = comments.filter((c) => {
    const matchesCategory = filter === 'ALL' || c.category === filter;
    const matchesSearch = c.text.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    const item: CommentItem = {
      id: `custom_${Date.now()}`,
      text: newText.trim().toUpperCase(),
      category: newCategory,
      type: newCategory === 'SURPRISE!' ? 'shock' : newCategory === 'SMILE LEGEND' ? 'smile' : 'general',
      language: newLang,
    };

    onAddComment(item);
    onSelectComment(item);
    soundEffects.playCommentChime();
    setNewText('');
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Add Custom Joke Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-purple-950/40 border border-purple-500/30">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-bold tracking-wider uppercase font-orbitron text-purple-300">
            Create Custom Punchline
          </h3>
        </div>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="e.g., HERO NUMBER ONE ENTERED!"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-cyan-400 text-white placeholder-slate-500 text-sm focus:outline-none transition"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as CommentItem['category'])}
            className="px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-300 text-xs font-mono-code focus:outline-none focus:border-cyan-400"
          >
            <option value="SWAG ALERT">⚡ SWAG ALERT</option>
            <option value="HERO MODE">🔥 HERO MODE</option>
            <option value="SURPRISE!">😲 SURPRISE!</option>
            <option value="SMILE LEGEND">😄 SMILE LEGEND</option>
            <option value="ROYALTY">👑 ROYALTY</option>
          </select>
          <select
            value={newLang}
            onChange={(e) => setNewLang(e.target.value as 'English')}
            className="px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-300 text-xs font-mono-code focus:outline-none focus:border-cyan-400"
          >
            <option value="English">English</option>
          </select>
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-purple-500/25 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add & Test</span>
          </button>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono-code whitespace-nowrap transition cursor-pointer ${
                filter === cat
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search punchline..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-500 text-xs focus:outline-none transition"
          />
        </div>
      </div>

      {/* Grid of Punchline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredComments.map((item) => {
          const isActive = item.text === activeComment;
          return (
            <div
              key={item.id}
              onClick={() => {
                onSelectComment(item);
                soundEffects.playCommentChime();
              }}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 relative group ${
                isActive
                  ? 'bg-gradient-to-br from-cyan-950/60 to-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Badge & Language */}
              <div className="flex items-center justify-between text-[11px] font-mono-code">
                <span
                  className={`px-2 py-0.5 rounded-md font-bold ${
                    item.category === 'SURPRISE!'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : item.category === 'SMILE LEGEND'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : item.category === 'ROYALTY'
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {item.category}
                </span>
                <span className="text-slate-500">{item.language}</span>
              </div>

              {/* Punchline Text */}
              <div className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition">
                &ldquo;{item.text}&rdquo;
              </div>

              {/* Action Indicator */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] font-mono-code">
                <span className={isActive ? 'text-cyan-400 font-bold' : 'text-slate-500 group-hover:text-slate-300'}>
                  {isActive ? '● ACTIVE ON CAMERA' : 'Click to display'}
                </span>
                {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
