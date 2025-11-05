// DailyFocus main logic
const STORAGE_KEY = 'dailyFocusData';
const PASSWORD_KEY = 'dailyFocusPassword';
const THEME_KEY = 'dailyFocusTheme';
const MAX_NOTES_PER_DAY = 50;

// Cached DOM references
const app = document.getElementById('app');
const notesList = document.getElementById('notesList');
const todosList = document.getElementById('todosList');
const addNoteBtn = document.getElementById('addNoteBtn');
const addTodoBtn = document.getElementById('addTodoBtn');
const exportBtn = document.getElementById('exportBtn');
const saveStatus = document.getElementById('saveStatus');
const todayDateEl = document.getElementById('todayDate');
const themeToggle = document.getElementById('themeToggle');
const lockToggle = document.getElementById('lockToggle');
const noteSearchInput = document.getElementById('noteSearch');
const toggleTodosBtn = document.getElementById('toggleTodosBtn');
const todosSection = document.querySelector('.section--todos');

const unlockScreen = document.getElementById('unlockScreen');
const unlockInput = document.getElementById('unlockInput');
const unlockConfirm = document.getElementById('unlockConfirm');
const unlockReset = document.getElementById('unlockReset');

const noteTemplate = document.getElementById('noteTemplate');
const todoTemplate = document.getElementById('todoTemplate');

let state = {
  notes: [],
  todos: [],
  lastOpened: new Date().toISOString().slice(0, 10),
  todosCollapsed: false
};

let noteSearchQuery = '';

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

const ensureUnlock = () => {
  const password = localStorage.getItem(PASSWORD_KEY);
  if (!password) {
    app.hidden = false;
    unlockScreen.hidden = true;
    return;
  }

  unlockScreen.hidden = false;
  app.hidden = true;

  const attemptUnlock = () => {
    const value = unlockInput.value.trim();
    if (!value) return;
    if (btoa(value) === password) {
      unlockInput.value = '';
      unlockScreen.hidden = true;
      app.hidden = false;
      showStatus('🔓 Welcome back!');
    } else {
      unlockInput.select();
      showStatus('❌ Incorrect passphrase');
    }
  };

  unlockConfirm.onclick = attemptUnlock;
  unlockInput.onkeydown = (event) => {
    if (event.key === 'Enter') {
      attemptUnlock();
    }
  };

  unlockReset.onclick = () => {
    localStorage.removeItem(PASSWORD_KEY);
    unlockInput.value = '';
    ensureUnlock();
    showStatus('🔁 Lock cleared');
  };
};

const setLock = () => {
  const current = localStorage.getItem(PASSWORD_KEY);
  const message = current ? 'Update your DailyFocus passphrase:' : 'Set a DailyFocus passphrase:';
  const next = prompt(message);
  if (next === null) return;
  const trimmed = next.trim();
  if (!trimmed) {
    localStorage.removeItem(PASSWORD_KEY);
    showStatus('🔓 Lock disabled');
  } else {
    localStorage.setItem(PASSWORD_KEY, btoa(trimmed));
    showStatus('🔒 Lock enabled');
  }
  ensureUnlock();
};

const createId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

// Rendering ---------------------------------------------------------------
const renderNotes = () => {
  notesList.innerHTML = '';
  const query = noteSearchQuery.trim().toLowerCase();
  const baseNotes = query
    ? state.notes.filter((note) => {
        const haystack = `${note.content} ${note.date}`.toLowerCase();
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
    return;
  }

  const sorted = [...baseNotes].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
  sorted.forEach((note) => {
    const node = noteTemplate.content.firstElementChild.cloneNode(true);
    const dateInput = node.querySelector('.note-date');
    const textarea = node.querySelector('.note-content');
    const deleteBtn = node.querySelector('.delete-note');

    dateInput.value = note.date;
    textarea.value = note.content;

    dateInput.onchange = (event) => {
      note.date = event.target.value;
      persistState();
      renderNotes();
    };

    textarea.oninput = (event) => {
      note.content = event.target.value;
      persistState();
    };

    deleteBtn.onclick = () => {
      state.notes = state.notes.filter((item) => item.id !== note.id);
      persistState('🗑️ Note removed');
      renderNotes();
    };

    notesList.append(node);
  });
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
    createdAt: new Date().toISOString()
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
  loadState();
  loadTheme();
  ensureUnlock();
  renderNotes();
  renderTodos();

  addNoteBtn.addEventListener('click', addNote);
  addTodoBtn.addEventListener('click', addTodo);
  exportBtn.addEventListener('click', exportData);
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  lockToggle.addEventListener('click', setLock);

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
