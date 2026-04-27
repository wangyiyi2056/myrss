import { useState, useEffect } from "react";
import {
  Rss,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  ChevronRight,
  Search,
  BookOpen,
  Languages,
  Heart,
  LayoutList,
  LayoutGrid,
  LayoutPanelLeft
} from "lucide-react";
import { motion } from "motion/react";
import { format, isToday } from "date-fns";

interface RSSItem {
  title: string;
  link: string;
  contentSnippet?: string;
  isoDate: string;
  content?: string;
}

interface RSSFeed {
  title: string;
  items: RSSItem[];
  description?: string;
}

interface SavedFeed {
  url: string;
  title: string;
}

const DEFAULT_FEEDS: SavedFeed[] = [
  { url: "https://www.theverge.com/rss/index.xml", title: "The Verge" },
  { url: "https://news.ycombinator.com/rss", title: "Hacker News" }
];

const translations = {
  zh: {
    title: "MyRSS",
    subtitle: "极简 RSS 阅读器",
    subscriptions: "我的订阅",
    addPlaceholder: "输入 RSS 链接...",
    addButton: "添加订阅",
    noSelected: "选择一个订阅源开始阅读",
    readFull: "阅读全文",
    addError: "添加失败，链接无效或暂不支持。",
    loadError: "无法加载 RSS 订阅，请检查链接。",
    today: "今天",
    recently: "最近",
    mustRead: "今日必看",
    unread: "条未读",
    favorites: "我的收藏",
    layoutList: "列表",
    layoutGrid: "网格",
    layoutCard: "窗口",
  },
  en: {
    title: "MyRSS",
    subtitle: "Minimal RSS Reader",
    subscriptions: "Subscriptions",
    addPlaceholder: "RSS URL...",
    addButton: "Add Feed",
    noSelected: "Select a feed to start reading",
    readFull: "Read Full Article",
    addError: "Add failed. Link invalid or unsupported.",
    loadError: "Failed to load feed. Check the link.",
    today: "Today",
    recently: "Recently",
    mustRead: "Must Read",
    unread: "unread",
    favorites: "My Favorites",
    layoutList: "List",
    layoutGrid: "Grid",
    layoutCard: "Card",
  }
};

type LayoutType = 'list' | 'grid' | 'card';

export default function App() {
  const [lang, setLang] = useState<'zh' | 'en'>(() => {
    const saved = localStorage.getItem("app-lang");
    return (saved === 'en' || saved === 'zh') ? saved : 'zh';
  });

  const t = translations[lang];

  const [savedFeeds, setSavedFeeds] = useState<SavedFeed[]>(() => {
    const saved = localStorage.getItem("rss-feeds");
    return saved ? JSON.parse(saved) : DEFAULT_FEEDS;
  });

  const [readArticles, setReadArticles] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("read-articles");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [bookmarkedArticles, setBookmarkedArticles] = useState<RSSItem[]>(() => {
    const saved = localStorage.getItem("bookmarked-articles");
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedFeedUrl, setSelectedFeedUrl] = useState<string>("today-must-read");
  const [currentFeed, setCurrentFeed] = useState<RSSFeed | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allFeedsData, setAllFeedsData] = useState<Record<string, RSSFeed>>({});

  const [layout, setLayout] = useState<LayoutType>(() => {
    const saved = localStorage.getItem("rss-layout");
    return (saved as LayoutType) || 'list';
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    localStorage.setItem("rss-feeds", JSON.stringify(savedFeeds));
    refreshAllFeeds();
  }, [savedFeeds]);

  useEffect(() => {
    localStorage.setItem("read-articles", JSON.stringify(Array.from(readArticles)));
    if (selectedFeedUrl === "today-must-read") {
      aggregateTodayFeeds();
    }
  }, [readArticles]);

  useEffect(() => {
    localStorage.setItem("bookmarked-articles", JSON.stringify(bookmarkedArticles));
    if (selectedFeedUrl === "favorites") {
      setCurrentFeed({
        title: t.favorites,
        items: bookmarkedArticles,
        description: "Your saved articles"
      });
    }
  }, [bookmarkedArticles, selectedFeedUrl]);

  useEffect(() => {
    localStorage.setItem("rss-layout", layout);
  }, [layout]);

  useEffect(() => {
    localStorage.setItem("app-lang", lang);
  }, [lang]);

  const refreshAllFeeds = async () => {
    const data: Record<string, RSSFeed> = {};
    setIsLoading(true);
    await Promise.all(savedFeeds.map(async (f) => {
      try {
        const res = await fetch(`/api/rss?url=${encodeURIComponent(f.url)}`);
        const json = await res.json();
        if (!json.error) data[f.url] = json;
      } catch (e) {
        console.error("Aggregation fetch error", e);
      }
    }));
    setAllFeedsData(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (selectedFeedUrl === "today-must-read") {
      aggregateTodayFeeds();
    } else if (selectedFeedUrl === "favorites") {
      setCurrentFeed({
        title: t.favorites,
        items: bookmarkedArticles,
        description: "Your saved articles"
      });
    } else if (selectedFeedUrl) {
      fetchFeed(selectedFeedUrl);
    }
  }, [selectedFeedUrl, allFeedsData]);

  const normalizeLink = (url: string) => url.replace(/\/$/, "");

  const aggregateTodayFeeds = () => {
    const itemsMap = new Map<string, RSSItem>();

    const activeUrls = new Set(savedFeeds.map(f => f.url));

    Object.entries(allFeedsData).forEach(([url, feed]) => {
      if (activeUrls.has(url)) {
        feed.items.forEach(item => {
          if (item.isoDate) {
            const itemDate = new Date(item.isoDate);
            const normalized = normalizeLink(item.link);
            if (isToday(itemDate) && !readArticles.has(normalized)) {
              if (!itemsMap.has(normalized)) {
                itemsMap.set(normalized, item);
              }
            }
          }
        });
      }
    });

    const items = Array.from(itemsMap.values());
    items.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());

    setCurrentFeed({
      title: t.mustRead,
      items: items,
      description: "Aggregated daily unread updates"
    });
  };

  const markAsRead = (link: string) => {
    const normalized = normalizeLink(link);
    setReadArticles(prev => {
      if (prev.has(normalized)) return prev;
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
  };

  const toggleBookmark = (e: React.MouseEvent, item: RSSItem) => {
    e.stopPropagation();
    const normalized = normalizeLink(item.link);
    const isPresent = bookmarkedArticles.some(b => normalizeLink(b.link) === normalized);

    if (isPresent) {
      setBookmarkedArticles(prev => prev.filter(b => normalizeLink(b.link) !== normalized));
    } else {
      setBookmarkedArticles(prev => [item, ...prev]);
    }
  };

  const getUnreadCount = () => {
    const unreadLinks = new Set<string>();
    const activeUrls = new Set(savedFeeds.map(f => f.url));

    Object.entries(allFeedsData).forEach(([url, feed]) => {
      if (activeUrls.has(url)) {
        feed.items.forEach(item => {
          const normalized = normalizeLink(item.link);
          if (item.isoDate && isToday(new Date(item.isoDate)) && !readArticles.has(normalized)) {
            unreadLinks.add(normalized);
          }
        });
      }
    });
    return unreadLinks.size;
  };

  const fetchFeed = async (url: string) => {
    if (url === "today-must-read" || url === "favorites") return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setCurrentFeed(data);
    } catch (err) {
      console.error("Fetch error:", err);
      alert(t.loadError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsAdding(true);
    try {
      const response = await fetch(`/api/rss?url=${encodeURIComponent(newUrl.trim())}`);
      const data = await response.json();

      if (data.error) {
        console.error("Server return error:", data);
        const errorMsg = lang === 'zh'
          ? `${data.error}\n原因：${data.suggestion || '未知原因'}`
          : `${data.error}\nReason: ${data.suggestion || 'Unknown reason'}`;
        alert(errorMsg);
        setIsAdding(false);
        return;
      }

      const newFeed = { url: newUrl.trim(), title: data.title || newUrl.trim() };

      if (savedFeeds.some(f => f.url === newFeed.url)) {
        alert(lang === 'zh' ? "该订阅已存在" : "Already subscribed");
        setIsAdding(false);
        return;
      }

      setSavedFeeds(prev => [...prev, newFeed]);
      setSelectedFeedUrl(newFeed.url);
      setNewUrl("");
      setIsAdding(false);
    } catch (err) {
      console.error("Add feed client error:", err);
      alert(t.addError);
      setIsAdding(false);
    }
  };

  const removeFeed = (url: string) => {
    setSavedFeeds(prev => {
      const filtered = prev.filter(f => f.url !== url);
      if (selectedFeedUrl === url) {
        if (filtered.length > 0) {
          setSelectedFeedUrl(filtered[0].url);
        } else {
          setSelectedFeedUrl("");
          setCurrentFeed(null);
        }
      }
      return filtered;
    });
  };

  return (
    <div className="flex h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-orange-200">
      {/* Sidebar */}
      <div className="w-72 bg-[#FFFFFF] border-r border-[#E5E5E0] flex flex-col shadow-sm z-10 transition-all">
        <div className="p-6 border-bottom border-[#E5E5E0] flex flex-col gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
            <Rss className="w-5 h-5 text-orange-600" />
            {t.title}
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-[#8E9299] font-semibold">
            {t.subtitle}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] uppercase tracking-widest text-[#8E9299] font-bold">
              {t.subscriptions}
            </span>
            <button
              onClick={refreshAllFeeds}
              disabled={isLoading}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-orange-500 transition-all"
              title="Refresh All"
            >
              <Loader2 className={`w-3 h-3 ${isLoading ? "animate-spin text-orange-500" : ""}`} />
            </button>
          </div>

          <div
            onClick={() => setSelectedFeedUrl("today-must-read")}
            className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all mb-4 ${
              selectedFeedUrl === "today-must-read"
                ? "bg-orange-500 text-white font-medium shadow-md shadow-orange-100"
                : "hover:bg-gray-50 text-gray-600"
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Rss className={`w-4 h-4 ${selectedFeedUrl === "today-must-read" ? "text-white" : "text-orange-500"}`} />
              <span className="truncate text-sm font-bold">{t.mustRead}</span>
            </div>
            {getUnreadCount() > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedFeedUrl === "today-must-read" ? "bg-white text-orange-600" : "bg-orange-600 text-white"}`}>
                {getUnreadCount()}
              </span>
            )}
          </div>

          <div
            onClick={() => setSelectedFeedUrl("favorites")}
            className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all mb-4 ${
              selectedFeedUrl === "favorites"
                ? "bg-red-500 text-white font-medium shadow-md shadow-red-100"
                : "hover:bg-gray-50 text-gray-600"
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Heart className={`w-4 h-4 ${selectedFeedUrl === "favorites" ? "text-white" : "text-red-500"}`} />
              <span className="truncate text-sm font-bold">{t.favorites}</span>
            </div>
            {bookmarkedArticles.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedFeedUrl === "favorites" ? "bg-white text-red-600" : "bg-gray-100 text-gray-400"}`}>
                {bookmarkedArticles.length}
              </span>
            )}
          </div>

          {savedFeeds.map(feed => (
            <div
              key={feed.url}
              onClick={() => setSelectedFeedUrl(feed.url)}
              className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                selectedFeedUrl === feed.url
                  ? "bg-orange-50 text-orange-700 font-medium border border-orange-100"
                  : "hover:bg-gray-50 text-gray-600 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className={`w-1.5 h-1.5 rounded-full ${selectedFeedUrl === feed.url ? "bg-orange-500" : "bg-gray-300"}`} />
                <span className="truncate text-sm">{feed.title}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFeed(feed.url); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-[#E5E5E0]">
          <form onSubmit={handleAddFeed} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder={t.addPlaceholder}
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full text-sm p-2 bg-[#F9F9F9] border border-[#E5E5E0] rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              type="submit"
              disabled={isAdding}
              className="w-full bg-[#1A1A1A] text-white text-sm py-2 rounded-md hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t.addButton}
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#E5E5E0] flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-lg truncate max-w-md">
              {currentFeed ? currentFeed.title : t.noSelected}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="flex items-center gap-2 bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors"
              title="Switch Language"
            >
              <Languages className="w-3.5 h-3.5" />
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setLayout('list')}
                className={`p-1.5 rounded-md transition-all ${layout === 'list' ? "bg-white shadow-sm text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
                title={t.layoutList}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout('grid')}
                className={`p-1.5 rounded-md transition-all ${layout === 'grid' ? "bg-white shadow-sm text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
                title={t.layoutGrid}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout('card')}
                className={`p-1.5 rounded-md transition-all ${layout === 'card' ? "bg-white shadow-sm text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
                title={t.layoutCard}
              >
                <LayoutPanelLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-scroll relative">
          <div className="max-w-5xl mx-auto w-full px-8 py-6">
            {isLoading ? (
              <div className="h-96 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : currentFeed ? (
            <div className={`grid gap-6 ${
              layout === 'list' ? "grid-cols-1" :
              layout === 'grid' ? "grid-cols-1 md:grid-cols-2" :
              "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            }`}>
              {currentFeed.items.map((item, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  key={item.link}
                  onClick={() => markAsRead(item.link)}
                  className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-default flex flex-col ${
                    readArticles.has(normalizeLink(item.link)) ? "opacity-60 border-[#E5E5E0]" : "border-orange-200/50"
                  } ${layout === 'card' ? "border-2" : ""}`}
                >
                  <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                        {!readArticles.has(normalizeLink(item.link)) && (
                          <span className="bg-orange-500 text-white px-1 rounded-sm text-[9px]">NEW</span>
                        )}
                        <span className="text-gray-400">{item.isoDate ? format(new Date(item.isoDate), 'yyyy.MM.dd') : t.recently}</span>
                        <span>•</span>
                        <span className="text-orange-500/70">{currentFeed.title}</span>
                      </div>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lg font-bold group-hover:text-orange-600 transition-colors leading-tight block"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        {item.title}
                      </a>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={(e) => toggleBookmark(e, item)}
                        className={`p-2 rounded-lg transition-all ${
                          bookmarkedArticles.some(b => normalizeLink(b.link) === normalizeLink(item.link))
                            ? "bg-red-50 text-red-500"
                            : "bg-gray-50 text-gray-400 hover:text-red-500"
                        }`}
                        title={t.favorites}
                      >
                        <Heart className={`w-4 h-4 ${bookmarkedArticles.some(b => normalizeLink(b.link) === normalizeLink(item.link)) ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <p className={`text-gray-600 text-sm leading-relaxed mb-4 ${layout === 'list' ? "line-clamp-2" : "line-clamp-3"}`}>
                    {item.contentSnippet || "..."}
                  </p>

                  <div className="mt-auto pt-4 border-t border-gray-50 flex justify-end">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] font-bold tracking-wider text-gray-400 hover:text-orange-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t.readFull} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-gray-400 space-y-4">
              <Search className="w-12 h-12 opacity-20" />
              <p>{t.noSelected}</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
