// DailyFocus main logic
const STORAGE_KEY = 'dailyFocusData';
const THEME_KEY = 'dailyFocusTheme';
const MAX_NOTES_PER_DAY = 50;

// Cached DOM references
const notesList = document.getElementById('notesList');
const todosList = document.getElementById('todosList');
const addNoteBtn = document.getElementById('addNoteBtn');
const addTodoBtn = document.getElementById('addTodoBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const saveStatus = document.getElementById('saveStatus');
const todayDateEl = document.getElementById('todayDate');
const themeToggle = document.getElementById('themeToggle');
const noteSearchInput = document.getElementById('noteSearch');
const toggleTodosBtn = document.getElementById('toggleTodosBtn');
const todosSection = document.querySelector('.section--todos');

const noteTemplate = document.getElementById('noteTemplate');
const todoTemplate = document.getElementById('todoTemplate');

let state = {
  notes: [],
  todos: [],
  lastOpened: new Date().toISOString().slice(0, 10),
  todosCollapsed: false,
  collapsedWeeks: {}
};

let noteSearchQuery = '';
let isRenderingNotes = false;

// Utilities ---------------------------------------------------------------
const formatDate = (date = new Date()) => {
  if (typeof date === 'string') return date;
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

const humanReadableDate = (isoDate) => {
  if (!isoDate) return '';
  return new Date(isoDate + 'T00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const showStatus = (message) => {
  saveStatus.textContent = message;
  if (!message) return;
  setTimeout(() => {
    if (saveStatus.textContent === message) {
      saveStatus.textContent = '';
    }
  }, 2500);
};

const persistState = (message) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  showStatus(message ?? '💾 Changes saved');
};

const removeLegacyLockScreen = () => {
  try {
    localStorage.removeItem('dailyFocusPassword');
  } catch (error) {
    console.warn('Unable to clear legacy password key', error);
  }

  document.body?.classList?.remove('is-locked');

  const legacySelectors = ['#lockScreen', '.lock-screen', '.app-lock', '[data-lock-overlay]'];
  legacySelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.parentElement) {
        node.parentElement.removeChild(node);
      } else if (typeof node.remove === 'function') {
        node.remove();
      }
    });
  });
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    } catch (error) {
      console.error('Failed to parse saved data', error);
    }
  }
  state.todosCollapsed = Boolean(state.todosCollapsed);
  state.collapsedWeeks =
    state.collapsedWeeks && typeof state.collapsedWeeks === 'object'
      ? state.collapsedWeeks
      : {};
  state.notes = Array.isArray(state.notes)
    ? state.notes.map(normalizeNote)
    : [];
  state.todos = Array.isArray(state.todos) ? state.todos : [];
};

const loadTheme = () => {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === 'dark' ? '🌞 Light' : '🌚 Dark';
};

const createId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const normalizeNote = (note) => ({
  id: note.id || createId(),
  date: note.date || formatDate(new Date()),
  content: typeof note.content === 'string' ? note.content : '',
  createdAt: note.createdAt || new Date().toISOString(),
  photo: note.photo || null,
  photoName: note.photoName || null,
  link: typeof note.link === 'string' ? note.link.trim() : ''
});

const getWeekRange = (isoDate) => {
  if (!isoDate) {
    const today = formatDate(new Date());
    return getWeekRange(today);
  }
  const date = new Date(`${isoDate}T00:00`);
  if (Number.isNaN(date.getTime())) {
    const today = formatDate(new Date());
    return getWeekRange(today);
  }
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startIso = formatDate(start);
  const endIso = formatDate(end);
  return {
    start: startIso,
    end: endIso,
    key: `${startIso}_${endIso}`,
    label: `${humanReadableDate(startIso)} — ${humanReadableDate(endIso)}`
  };
};

// Rendering ---------------------------------------------------------------
const renderNotes = () => {
  isRenderingNotes = true;
  notesList.innerHTML = '';
  const query = noteSearchQuery.trim().toLowerCase();
  const baseNotes = query
    ? state.notes.filter((note) => {
        const haystack = `${note.content} ${note.date} ${note.link || ''}`.toLowerCase();
        return haystack.includes(query);
      })
    : state.notes;

  if (!baseNotes.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = query
      ? `No notes found for “${noteSearchQuery.trim()}”.`
      : 'Add a quick reflection to start your streak.';
    notesList.append(empty);
    isRenderingNotes = false;
    return;
  }

  const sorted = [...baseNotes].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
  const groups = sorted.reduce((acc, note) => {
    const range = getWeekRange(note.date);
    if (!acc[range.key]) {
      acc[range.key] = {
        ...range,
        notes: []
      };
    }
    acc[range.key].notes.push(note);
    return acc;
  }, {});

  const activeKeys = new Set();
  Object.values(groups)
    .sort((a, b) => b.start.localeCompare(a.start))
    .forEach((group) => {
      activeKeys.add(group.key);
      const details = document.createElement('details');
      details.className = 'week-group';
      details.dataset.week = group.key;
      const shouldOpen = query ? true : !state.collapsedWeeks?.[group.key];
      details.open = shouldOpen;

      const summary = document.createElement('summary');
      summary.className = 'week-group__summary';
      summary.textContent = `${group.label} (${group.notes.length})`;
      summary.setAttribute('aria-label', `${group.label} (${group.notes.length} notes)`);
      details.append(summary);

      const list = document.createElement('div');
      list.className = 'week-group__notes';

      group.notes.forEach((note) => {
        const node = noteTemplate.content.firstElementChild.cloneNode(true);
        const dateInput = node.querySelector('.note-date');
        const textarea = node.querySelector('.note-content');
        const deleteBtn = node.querySelector('.delete-note');
        const linkInput = node.querySelector('.note-link');
        const linkPreview = node.querySelector('.note-link-preview');
        const photoInput = node.querySelector('.note-photo-input');
        const photoWrapper = node.querySelector('.note-photo-preview');
        const photoImg = photoWrapper.querySelector('img');
        const removePhotoBtn = node.querySelector('.remove-photo');

        dateInput.value = note.date;
        textarea.value = note.content;
        linkInput.value = note.link || '';

        const updateLinkPreview = () => {
          const trimmed = linkInput.value.trim();
          if (!trimmed) {
            linkPreview.hidden = true;
            return;
          }

          try {
            const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
            const href = hasProtocol ? trimmed : `https://${trimmed}`;
            const url = new URL(href);
            linkPreview.href = url.href;
            const display = url.href.replace(/^https?:\/\//, '');
            linkPreview.textContent = `🔗 ${display}`;
            linkPreview.hidden = false;
          } catch (error) {
            linkPreview.hidden = true;
          }
        };

        const updatePhotoPreview = (message) => {
          if (note.photo) {
            photoImg.src = note.photo;
            photoImg.alt = note.photoName ? `Attachment: ${note.photoName}` : 'Uploaded note attachment';
            photoWrapper.hidden = false;
            if (message) {
              persistState(message);
            } else {
              persistState();
            }
          }
        };

        updateLinkPreview();

        if (note.photo) {
          photoImg.src = note.photo;
          photoImg.alt = note.photoName ? `Attachment: ${note.photoName}` : 'Uploaded note attachment';
          photoWrapper.hidden = false;
        } else {
          photoWrapper.hidden = true;
        }

        dateInput.onchange = (event) => {
          note.date = event.target.value;
          persistState();
          renderNotes();
        };

        textarea.oninput = (event) => {
          note.content = event.target.value;
          persistState();
        };

        linkInput.oninput = (event) => {
          note.link = event.target.value.trim();
          updateLinkPreview();
          persistState();
        };

        photoInput.onchange = (event) => {
          const input = event.target;
          const file = input.files?.[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) {
            showStatus('⚠️ Please choose an image file.');
            input.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            note.photo = reader.result;
            note.photoName = file.name;
            updatePhotoPreview('🖼️ Photo added');
            renderNotes();
            input.value = '';
          };
          reader.onerror = () => {
            showStatus('❌ Failed to read the selected file');
            input.value = '';
          };
          reader.readAsDataURL(file);
        };

        removePhotoBtn.onclick = () => {
          if (!note.photo) return;
          note.photo = null;
          note.photoName = null;
          persistState('🗑️ Photo removed');
          renderNotes();
        };

        deleteBtn.onclick = () => {
          state.notes = state.notes.filter((item) => item.id !== note.id);
          persistState('🗑️ Note removed');
          renderNotes();
        };

        list.append(node);
      });

      details.append(list);
      details.addEventListener('toggle', () => {
        if (isRenderingNotes) return;
        state.collapsedWeeks = state.collapsedWeeks || {};
        state.collapsedWeeks[group.key] = !details.open;
        persistState();
      });

      notesList.append(details);
    });

  if (state.collapsedWeeks) {
    Object.keys(state.collapsedWeeks).forEach((key) => {
      if (!activeKeys.has(key)) {
        delete state.collapsedWeeks[key];
      }
    });
  }

  isRenderingNotes = false;
};

const renderTodos = () => {
  todosList.innerHTML = '';
  const remainingOpen = state.todos.filter((todo) => !todo.done).length;
  const collapsed = Boolean(state.todosCollapsed);
  if (toggleTodosBtn) {
    toggleTodosBtn.textContent = collapsed
      ? remainingOpen
        ? `Show TODOs (${remainingOpen})`
        : 'Show TODOs'
      : remainingOpen
      ? `Hide TODOs (${remainingOpen})`
      : 'Hide TODOs';
    toggleTodosBtn.setAttribute('aria-expanded', String(!collapsed));
  }
  if (todosSection) {
    todosSection.classList.toggle('is-collapsed', collapsed);
  }

  if (!state.todos.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Capture your next action to stay focused.';
    todosList.append(empty);
    return;
  }

  const sorted = [...state.todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.deadline && b.deadline) {
      const deadlineComparison = a.deadline.localeCompare(b.deadline);
      if (deadlineComparison !== 0) return deadlineComparison;
    } else if (a.deadline || b.deadline) {
      return a.deadline ? -1 : 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  sorted.forEach((todo) => {
    const node = todoTemplate.content.firstElementChild.cloneNode(true);
    const createdLabel = node.querySelector('.todo-created');
    const doneCheckbox = node.querySelector('.todo-done');
    const textInput = node.querySelector('.todo-text');
    const deadlineInput = node.querySelector('.todo-deadline');
    const deleteBtn = node.querySelector('.delete-todo');

    createdLabel.textContent = `Created ${humanReadableDate(todo.createdAt)}`;
    doneCheckbox.checked = todo.done;
    textInput.value = todo.text;
    deadlineInput.value = todo.deadline || '';

    if (todo.done) {
      node.classList.add('card--done');
      textInput.classList.add('todo-text--done');
    }

    doneCheckbox.onchange = (event) => {
      todo.done = event.target.checked;
      persistState();
      renderTodos();
    };

    textInput.oninput = (event) => {
      todo.text = event.target.value;
      persistState();
    };

    deadlineInput.onchange = (event) => {
      todo.deadline = event.target.value || null;
      persistState();
      renderTodos();
    };

    deleteBtn.onclick = () => {
      state.todos = state.todos.filter((item) => item.id !== todo.id);
      persistState('🗑️ TODO removed');
      renderTodos();
    };

    todosList.append(node);
  });
};

// Actions ----------------------------------------------------------------
const addNote = () => {
  const today = formatDate(new Date());
  const todaysNotes = state.notes.filter((note) => note.date === today);
  if (todaysNotes.length >= MAX_NOTES_PER_DAY) {
    showStatus(`⚠️ Limit reached (${MAX_NOTES_PER_DAY} notes for today).`);
    return;
  }

  state.notes.push({
    id: createId(),
    date: today,
    content: '',
    createdAt: new Date().toISOString(),
    photo: null,
    photoName: null,
    link: ''
  });
  persistState('✅ Saved your note for today');
  renderNotes();
  focusFirstNote();
};

const focusFirstNote = () => {
  const firstNote = notesList.querySelector('.card textarea');
  if (firstNote) {
    requestAnimationFrame(() => firstNote.focus());
  }
};

const addTodo = () => {
  state.todos.push({
    id: createId(),
    text: '',
    createdAt: formatDate(new Date()),
    deadline: null,
    done: false
  });
  persistState('✅ TODO added');
  renderTodos();
  focusNewestTodo();
};

const focusNewestTodo = () => {
  const newest = todosList.querySelector('.card:last-of-type .todo-text');
  if (newest) {
    requestAnimationFrame(() => newest.focus());
  }
};

const exportData = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `daily_summary_${formatDate(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showStatus('📤 Exported daily summary');
};

const importData = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = JSON.parse(text);
      const importedNotes = Array.isArray(parsed.notes)
        ? parsed.notes.map(normalizeNote)
        : state.notes;
      const importedTodos = Array.isArray(parsed.todos) ? parsed.todos : state.todos;
      const collapsedWeeks =
        parsed && typeof parsed.collapsedWeeks === 'object' && parsed.collapsedWeeks !== null
          ? parsed.collapsedWeeks
          : {};
      state = {
        ...state,
        ...parsed,
        notes: importedNotes,
        todos: importedTodos,
        todosCollapsed: Boolean(parsed.todosCollapsed),
        collapsedWeeks
      };
      persistState('📥 Data imported');
      renderNotes();
      renderTodos();
    } catch (error) {
      console.error('Failed to import data', error);
      showStatus('❌ Failed to import data');
    } finally {
      importInput.value = '';
    }
  };
  reader.onerror = () => {
    showStatus('❌ Failed to read the file');
    importInput.value = '';
  };
  reader.readAsText(file);
};

const bindGlobalShortcuts = () => {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      addNote();
    }
    if (event.altKey && event.key === 'Enter') {
      event.preventDefault();
      addTodo();
    }
  });
};

const init = () => {
  todayDateEl.textContent = humanReadableDate(formatDate(new Date()));
  removeLegacyLockScreen();
  loadState();
  loadTheme();
  renderNotes();
  renderTodos();

  addNoteBtn.addEventListener('click', addNote);
  addTodoBtn.addEventListener('click', addTodo);
  exportBtn.addEventListener('click', exportData);
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (event) => {
      const [file] = event.target.files || [];
      importData(file);
    });
  }
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  if (noteSearchInput) {
    noteSearchInput.value = noteSearchQuery;
    noteSearchInput.addEventListener('input', (event) => {
      noteSearchQuery = event.target.value;
      renderNotes();
    });
    noteSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && noteSearchQuery) {
        noteSearchQuery = '';
        noteSearchInput.value = '';
        renderNotes();
      }
    });
  }

  if (toggleTodosBtn) {
    toggleTodosBtn.addEventListener('click', () => {
      state.todosCollapsed = !state.todosCollapsed;
      persistState(state.todosCollapsed ? '📁 TODOs hidden' : '📂 TODOs visible');
      renderTodos();
    });
  }

  bindGlobalShortcuts();
};

document.addEventListener('DOMContentLoaded', init);
