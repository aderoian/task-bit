/* global Sortable */
(function () {
    'use strict';

    const GUEST_STORAGE_KEY = 'taskbit_guest_v1';
    const MAX_GUEST_LISTS = 3;
    const GUEST_NOTEBOOK_ID = 'guest-nb';

    /** @type {{ notebooks: any[], activeNotebookId: any }} */
    let state = { notebooks: [], activeNotebookId: null };
    /** @type {Record<string, Sortable>} */
    let sortables = {};

    const taskbit = window.TASKBIT || { loggedIn: false, initialState: null };

    function uid(prefix) {
        return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    function toast(msg) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(function () {
            el.classList.remove('show');
        }, 3200);
    }

    function defaultGuestState() {
        return {
            notebooks: [
                {
                    id: GUEST_NOTEBOOK_ID,
                    name: 'My Notebook',
                    position: 0,
                    lists: [],
                },
            ],
            activeNotebookId: GUEST_NOTEBOOK_ID,
        };
    }

    function loadGuestFromStorage() {
        try {
            const raw = localStorage.getItem(GUEST_STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || data.version !== 1 || !data.notebook) return null;
            const nb = data.notebook;
            const lists = (nb.lists || []).map(function (l, idx) {
                const listId = l.id || uid('gl');
                const items = (l.items || []).map(function (it, j) {
                    return {
                        id: it.id || uid('gi'),
                        title: String(it.title || ''),
                        completed: !!it.completed,
                        position: j,
                    };
                });
                return {
                    id: listId,
                    name: String(l.name || 'List'),
                    position: typeof l.position === 'number' ? l.position : idx,
                    items: items,
                };
            });
            return {
                notebooks: [
                    {
                        id: nb.id || GUEST_NOTEBOOK_ID,
                        name: String(nb.name || 'My Notebook'),
                        position: 0,
                        lists: lists,
                    },
                ],
                activeNotebookId: nb.id || GUEST_NOTEBOOK_ID,
            };
        } catch {
            return null;
        }
    }

    function persistGuest() {
        if (taskbit.loggedIn) return;
        const nb = getActiveNotebook();
        if (!nb) return;
        const payload = {
            version: 1,
            notebook: {
                id: nb.id,
                name: nb.name,
                lists: (nb.lists || []).map(function (l) {
                    return {
                        id: l.id,
                        name: l.name,
                        position: l.position,
                        items: (l.items || []).map(function (it) {
                            return {
                                id: it.id,
                                title: it.title,
                                completed: it.completed,
                                position: it.position,
                            };
                        }),
                    };
                }),
            },
        };
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(payload));
    }

    function clearGuestStorage() {
        localStorage.removeItem(GUEST_STORAGE_KEY);
    }

    function guestPayloadForMerge() {
        const raw = localStorage.getItem(GUEST_STORAGE_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            if (!data || !data.notebook) return null;
            const nb = data.notebook;
            return {
                notebook: {
                    name: String(nb.name || 'Imported'),
                    lists: (nb.lists || []).map(function (l) {
                        return {
                            name: String(l.name || 'List'),
                            items: (l.items || []).map(function (it) {
                                return {
                                    title: String(it.title || ''),
                                    completed: !!it.completed,
                                };
                            }),
                        };
                    }),
                },
            };
        } catch {
            return null;
        }
    }

    function initStateFromServer(initial) {
        const nb = (initial && initial.notebooks) || [];
        const prev = state.activeNotebookId;
        state.notebooks = nb;
        if (prev && nb.some(function (n) {
            return n.id === prev;
        })) {
            state.activeNotebookId = prev;
        } else {
            state.activeNotebookId = nb[0] ? nb[0].id : null;
        }
    }

    function getActiveNotebook() {
        return state.notebooks.find(function (n) {
            return n.id === state.activeNotebookId;
        });
    }

    async function api(path, opts) {
        const res = await fetch(path, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
            ...opts,
        });
        let body = null;
        const text = await res.text();
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = { error: 'Invalid server response' };
        }
        if (!res.ok) {
            const err = new Error(body && body.error ? body.error : 'Request failed');
            err.status = res.status;
            err.body = body;
            throw err;
        }
        return body;
    }

    async function mergeGuestIfNeeded() {
        const payload = guestPayloadForMerge();
        if (!payload) return;
        if (!payload.notebook.lists || payload.notebook.lists.length === 0) {
            clearGuestStorage();
            return;
        }
        try {
            const data = await api('/api/merge', { method: 'POST', body: JSON.stringify(payload) });
            clearGuestStorage();
            if (data && data.state) {
                initStateFromServer(data.state);
            }
            toast('Your guest notes were saved to your account.');
        } catch (e) {
            console.error(e);
            toast('Could not merge guest data. It remains on this device.');
        }
    }

    function destroySortables() {
        Object.keys(sortables).forEach(function (k) {
            try {
                sortables[k].destroy();
            } catch (_) {}
            delete sortables[k];
        });
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function itemTitleMaxHeightPx() {
        var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        var cssCap = Math.round(h - 7.5 * rootFs);
        return Math.max(96, cssCap);
    }

    function autoResizeTextarea(el) {
        if (!el || el.tagName !== 'TEXTAREA') return;
        var max = itemTitleMaxHeightPx();
        el.style.height = 'auto';
        var sh = el.scrollHeight;
        var next = Math.min(sh, max);
        el.style.height = next + 'px';
        el.style.overflowY = sh > max ? 'auto' : 'hidden';
    }

    var resizeTitlesTimer;
    function scheduleResizeAllItemTitles() {
        clearTimeout(resizeTitlesTimer);
        resizeTitlesTimer = setTimeout(function () {
            document.querySelectorAll('#board .item-title').forEach(function (ta) {
                autoResizeTextarea(ta);
            });
        }, 100);
    }

    function renderTabs() {
        const host = document.getElementById('notebook-tabs');
        const addBtn = document.getElementById('btn-add-notebook');
        const renameBtn = document.getElementById('btn-rename-notebook');
        const guestBanner = document.getElementById('guest-banner');
        if (!host) return;

        if (taskbit.loggedIn) {
            guestBanner.classList.add('hidden');
            addBtn.classList.remove('hidden');
            renameBtn.classList.remove('hidden');
        } else {
            guestBanner.classList.remove('hidden');
            addBtn.classList.add('hidden');
            renameBtn.classList.remove('hidden');
        }

        host.innerHTML = '';
        state.notebooks.forEach(function (nb) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'note-tab' + (nb.id === state.activeNotebookId ? ' active' : '');
            tab.textContent = nb.name || 'Notebook';
            tab.dataset.notebookId = String(nb.id);
            tab.addEventListener('click', function () {
                if (state.activeNotebookId === nb.id) return;
                state.activeNotebookId = nb.id;
                render();
            });
            host.appendChild(tab);
        });

        if (state.notebooks.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'empty-hint';
            hint.innerHTML = taskbit.loggedIn
                ? '<p>No notebooks yet. Create one to begin.</p>'
                : '<p>Welcome! Add lists below — stored in this browser only.</p>';
            host.appendChild(hint);
        }
    }

    function renderBoard() {
        const board = document.getElementById('board');
        if (!board) return;
        board.innerHTML = '';
        const nb = getActiveNotebook();
        if (!nb) return;

        const sortedLists = (nb.lists || []).slice().sort(function (a, b) {
            return (a.position || 0) - (b.position || 0);
        });
        sortedLists.forEach(function (list) {
            const col = document.createElement('div');
            col.className = 'list-column';
            col.dataset.listId = String(list.id);

            const header = document.createElement('div');
            header.className = 'list-header';
            header.innerHTML =
                '<span class="icon-btn list-column-handle" title="Reorder list" aria-label="Reorder list">☰</span>' +
                '<h2 class="list-title" title="Rename list">' +
                esc(list.name) +
                '</h2>' +
                '<button type="button" class="icon-btn list-del" title="Delete list">\u00d7</button>';
            header.querySelector('.list-title').addEventListener('click', function () {
                renameList(list.id);
            });
            header.querySelector('.list-del').addEventListener('click', function () {
                deleteList(list.id);
            });

            const ul = document.createElement('div');
            ul.className = 'item-list';
            const items = (list.items || []).slice().sort(function (a, b) {
                return (a.position || 0) - (b.position || 0);
            });
            items.forEach(function (it) {
                ul.appendChild(renderItemRow(nb, list, it));
            });

            const addRow = document.createElement('div');
            addRow.className = 'list-footer';
            addRow.innerHTML =
                '<button type="button" class="btn btn-secondary" style="width:100%;margin-top:0.4rem">+ Task</button>';
            addRow.querySelector('button').addEventListener('click', function () {
                addItem(list.id);
            });

            col.appendChild(header);
            col.appendChild(ul);
            col.appendChild(addRow);
            board.appendChild(col);
        });
    }

    function renderItemRow(nb, list, it) {
        const row = document.createElement('div');
        row.className = 'todo-item' + (it.completed ? ' done' : '');
        row.dataset.itemId = String(it.id);
        row.innerHTML =
            '<span class="icon-btn drag-handle" title="Drag" aria-hidden="true">\u2630</span>' +
            '<input type="checkbox" class="item-check" ' +
            (it.completed ? 'checked' : '') +
            ' aria-label="Done">' +
            '<textarea class="item-title" rows="2" spellcheck="false"></textarea>' +
            '<button type="button" class="icon-btn item-del no-drag" title="Delete">\u00d7</button>';
        const ta = row.querySelector('.item-title');
        ta.value = it.title || '';
        autoResizeTextarea(ta);
        ta.addEventListener('input', function () {
            autoResizeTextarea(ta);
        });
        const check = row.querySelector('.item-check');
        check.addEventListener('change', function () {
            row.classList.toggle('done', check.checked);
            updateItemCompletion(nb.id, list.id, it.id, check.checked);
        });
        ta.addEventListener('change', function () {
            updateItemTitle(nb.id, list.id, it.id, ta.value);
        });
        row.querySelector('.item-del').addEventListener('click', function () {
            deleteItem(nb.id, list.id, it.id);
        });
        return row;
    }

    function normalizePositions(notebook) {
        (notebook.lists || []).forEach(function (l, i) {
            l.position = i;
            (l.items || []).forEach(function (it, j) {
                it.position = j;
            });
        });
    }

    function applyDomOrderToState() {
        const nb = getActiveNotebook();
        if (!nb) return;
        const board = document.getElementById('board');
        if (!board) return;

        const cols = Array.from(board.querySelectorAll('.list-column'));
        const listMap = Object.fromEntries((nb.lists || []).map(function (l) {
            return [String(l.id), l];
        }));
        const newLists = [];
        cols.forEach(function (col, idx) {
            const id = col.dataset.listId;
            const l = listMap[id];
            if (!l) return;
            l.position = idx;
            const rows = Array.from(col.querySelectorAll('.todo-item'));
            const itemMap = Object.fromEntries((l.items || []).map(function (it) {
                return [String(it.id), it];
            }));
            const newItems = [];
            rows.forEach(function (row, j) {
                const iid = row.dataset.itemId;
                const it = itemMap[iid];
                if (!it) return;
                it.position = j;
                newItems.push(it);
            });
            l.items = newItems;
            newLists.push(l);
        });
        nb.lists = newLists;
    }

    function collectItemUpdates(notebook) {
        const updates = [];
        (notebook.lists || []).forEach(function (l) {
            (l.items || []).forEach(function (it, idx) {
                updates.push({
                    id: typeof it.id === 'number' ? it.id : parseInt(String(it.id), 10),
                    list_id: typeof l.id === 'number' ? l.id : parseInt(String(l.id), 10),
                    position: idx,
                });
            });
        });
        return updates.filter(function (u) {
            return !isNaN(u.id) && !isNaN(u.list_id);
        });
    }

    function collectListIdsFromDom() {
        const board = document.getElementById('board');
        if (!board) return [];
        return Array.from(board.querySelectorAll('.list-column')).map(function (c) {
            return parseInt(c.dataset.listId, 10);
        });
    }

    function collectNotebookTabIdsFromDom() {
        const host = document.getElementById('notebook-tabs');
        if (!host) return [];
        return Array.from(host.querySelectorAll('.note-tab')).map(function (t) {
            return parseInt(t.dataset.notebookId, 10);
        });
    }

    async function syncReorderItems() {
        const nb = getActiveNotebook();
        if (!nb || !taskbit.loggedIn) return;
        const updates = collectItemUpdates(nb);
        if (!updates.length) return;
        const data = await api('/api/reorder/items', { method: 'POST', body: JSON.stringify({ updates }) });
        if (data.state) initStateFromServer(data.state);
    }

    async function syncReorderLists() {
        const nb = getActiveNotebook();
        if (!nb || !taskbit.loggedIn) return;
        const ids = collectListIdsFromDom();
        if (!ids.length) return;
        const data = await api('/api/reorder/lists', {
            method: 'POST',
            body: JSON.stringify({ notebook_id: nb.id, list_ids: ids }),
        });
        if (data.state) initStateFromServer(data.state);
    }

    async function syncReorderNotebooks() {
        if (!taskbit.loggedIn) return;
        const ids = collectNotebookTabIdsFromDom();
        if (!ids.length) return;
        const data = await api('/api/reorder/notebooks', {
            method: 'POST',
            body: JSON.stringify({ notebook_ids: ids }),
        });
        if (data.state) initStateFromServer(data.state);
    }

    function setupSortables() {
        destroySortables();
        const nb = getActiveNotebook();
        if (!nb) return;

        const board = document.getElementById('board');
        if (board && taskbit.loggedIn) {
            sortables.board = Sortable.create(board, {
                animation: 180,
                handle: '.list-column-handle',
                draggable: '.list-column',
                ghostClass: 'sortable-ghost',
                onEnd: async function () {
                    applyDomOrderToState();
                    try {
                        if (taskbit.loggedIn) await syncReorderLists();
                    } catch (e) {
                        toast(e.message || 'Could not reorder lists');
                    }
                    persistGuest();
                    render();
                },
            });
        } else if (board && !taskbit.loggedIn) {
            sortables.board = Sortable.create(board, {
                animation: 180,
                handle: '.list-column-handle',
                draggable: '.list-column',
                onEnd: function () {
                    applyDomOrderToState();
                    normalizePositions(nb);
                    persistGuest();
                    render();
                },
            });
        }

        const groups = 'tasks-nb-' + String(nb.id);
        board.querySelectorAll('.item-list').forEach(function (el) {
            const sid = 'items-' + el.closest('.list-column').dataset.listId;
            sortables[sid] = Sortable.create(el, {
                group: { name: groups, pull: true, put: true },
                animation: 180,
                handle: '.drag-handle',
                draggable: '.todo-item',
                filter: 'textarea, .item-check, .no-drag',
                ghostClass: 'sortable-ghost',
                onEnd: async function () {
                    applyDomOrderToState();
                    normalizePositions(nb);
                    try {
                        if (taskbit.loggedIn) await syncReorderItems();
                    } catch (e) {
                        toast(e.message || 'Could not sync tasks');
                        if (taskbit.loggedIn) {
                            const st = await api('/api/state', { method: 'GET' });
                            initStateFromServer(st);
                        }
                    }
                    persistGuest();
                    render();
                },
            });
        });

        if (taskbit.loggedIn && state.notebooks.length > 1) {
            const tabs = document.getElementById('notebook-tabs');
            if (tabs) {
                sortables.tabs = Sortable.create(tabs, {
                    animation: 160,
                    draggable: '.note-tab',
                    ghostClass: 'sortable-ghost',
                    onEnd: async function () {
                        const ids = collectNotebookTabIdsFromDom();
                        const orderMap = Object.fromEntries(ids.map(function (id, idx) {
                            return [id, idx];
                        }));
                        state.notebooks.forEach(function (n) {
                            if (orderMap[n.id] !== undefined) n.position = orderMap[n.id];
                        });
                        state.notebooks.sort(function (a, b) {
                            return (a.position || 0) - (b.position || 0);
                        });
                        try {
                            await syncReorderNotebooks();
                        } catch (e) {
                            toast(e.message || 'Could not reorder notebooks');
                        }
                        render();
                    },
                });
            }
        }
    }

    function render() {
        normalizePositions(getActiveNotebook() || { lists: [] });
        renderTabs();
        renderBoard();
        setupSortables();
        document.querySelectorAll('#board .item-title').forEach(function (ta) {
            autoResizeTextarea(ta);
        });
    }

    function bindViewportResizeForTitles() {
        window.addEventListener('resize', scheduleResizeAllItemTitles);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', scheduleResizeAllItemTitles);
        }
    }

    async function addNotebook() {
        if (!taskbit.loggedIn) return;
        const name = prompt('Notebook name', 'New notebook');
        if (name === null) return;
        const trimmed = String(name).trim() || 'New notebook';
        const data = await api('/api/notebooks', {
            method: 'POST',
            body: JSON.stringify({ name: trimmed }),
        });
        if (data.state) initStateFromServer(data.state);
        state.activeNotebookId = data.id;
        render();
    }

    async function renameActiveNotebook() {
        const n = getActiveNotebook();
        if (!n) return;
        const name = prompt('Rename notebook', n.name);
        if (name === null) return;
        const trimmed = String(name).trim();
        if (!trimmed) return;
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/notebooks/' + encodeURIComponent(n.id), {
                    method: 'PATCH',
                    body: JSON.stringify({ name: trimmed }),
                });
                if (data.state) initStateFromServer(data.state);
            } else {
                n.name = trimmed;
                persistGuest();
            }
        } catch (e) {
            toast(e.message || 'Could not rename notebook');
        }
        render();
    }

    function findList(notebookId, listId) {
        const nb = state.notebooks.find(function (n) {
            return n.id === notebookId;
        });
        if (!nb) return null;
        return (nb.lists || []).find(function (l) {
            return l.id === listId;
        });
    }

    async function addList() {
        const nb = getActiveNotebook();
        if (!nb) {
            if (taskbit.loggedIn) {
                toast('Create a notebook first.');
                return;
            }
            toast('Open the app to add a list.');
            return;
        }
        if (!taskbit.loggedIn && (nb.lists || []).length >= MAX_GUEST_LISTS) {
            toast('Guest limit: ' + MAX_GUEST_LISTS + ' lists max. Sign in for more.');
            return;
        }
        const name = prompt('List name', 'New list');
        if (name === null) return;
        const trimmed = String(name).trim() || 'New list';
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/notebooks/' + encodeURIComponent(nb.id) + '/lists', {
                    method: 'POST',
                    body: JSON.stringify({ name: trimmed }),
                });
                if (data.state) initStateFromServer(data.state);
            } else {
                const list = {
                    id: uid('gl'),
                    name: trimmed,
                    position: (nb.lists || []).length,
                    items: [],
                };
                nb.lists = nb.lists || [];
                nb.lists.push(list);
                persistGuest();
            }
        } catch (e) {
            toast(e.message || 'Could not create list');
        }
        render();
    }

    async function renameList(listId) {
        const nb = getActiveNotebook();
        if (!nb) return;
        const list = findList(nb.id, listId);
        if (!list) return;
        const name = prompt('Rename list', list.name);
        if (name === null) return;
        const trimmed = String(name).trim();
        if (!trimmed) return;
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/lists/' + encodeURIComponent(listId), {
                    method: 'PATCH',
                    body: JSON.stringify({ name: trimmed }),
                });
                if (data.state) initStateFromServer(data.state);
            } else {
                list.name = trimmed;
                persistGuest();
            }
        } catch (e) {
            toast(e.message || 'Could not rename list');
        }
        render();
    }

    async function deleteList(listId) {
        const nb = getActiveNotebook();
        if (!nb) return;
        if (!confirm('Delete this list and all its tasks?')) return;
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/lists/' + encodeURIComponent(listId), { method: 'DELETE' });
                if (data.state) initStateFromServer(data.state);
            } else {
                nb.lists = (nb.lists || []).filter(function (l) {
                    return l.id !== listId;
                });
                normalizePositions(nb);
                persistGuest();
            }
        } catch (e) {
            toast(e.message || 'Could not delete list');
        }
        render();
    }

    async function addItem(listId) {
        const nb = getActiveNotebook();
        if (!nb) return;
        const list = findList(nb.id, listId);
        if (!list) return;
        const title = prompt('Task', '');
        if (title === null) return;
        const trimmed = String(title).trim();
        if (!trimmed) return;
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/lists/' + encodeURIComponent(listId) + '/items', {
                    method: 'POST',
                    body: JSON.stringify({ title: trimmed }),
                });
                if (data.state) initStateFromServer(data.state);
            } else {
                list.items = list.items || [];
                list.items.push({
                    id: uid('gi'),
                    title: trimmed,
                    completed: false,
                    position: list.items.length,
                });
                persistGuest();
            }
        } catch (e) {
            toast(e.message || 'Could not add task');
        }
        render();
    }

    async function updateItemCompletion(notebookId, listId, itemId, completed) {
        const list = findList(notebookId, listId);
        if (!list) return;
        const it = (list.items || []).find(function (x) {
            return x.id === itemId;
        });
        if (!it) return;
        it.completed = completed;
        if (taskbit.loggedIn) {
            try {
                const data = await api('/api/items/' + encodeURIComponent(itemId), {
                    method: 'PATCH',
                    body: JSON.stringify({ completed: completed }),
                });
                if (data.state) initStateFromServer(data.state);
            } catch (e) {
                toast(e.message || 'Could not update task');
            }
        } else {
            persistGuest();
        }
    }

    async function updateItemTitle(notebookId, listId, itemId, title) {
        const list = findList(notebookId, listId);
        if (!list) return;
        const it = (list.items || []).find(function (x) {
            return x.id === itemId;
        });
        if (!it) return;
        const trimmed = String(title).trim();
        if (!trimmed) {
            toast('Task title cannot be empty.');
            render();
            return;
        }
        it.title = trimmed;
        if (taskbit.loggedIn) {
            try {
                const data = await api('/api/items/' + encodeURIComponent(itemId), {
                    method: 'PATCH',
                    body: JSON.stringify({ title: trimmed }),
                });
                if (data.state) initStateFromServer(data.state);
            } catch (e) {
                toast(e.message || 'Could not save task');
            }
        } else {
            persistGuest();
        }
    }

    async function deleteItem(notebookId, listId, itemId) {
        const list = findList(notebookId, listId);
        if (!list) return;
        if (!confirm('Delete this task?')) return;
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/items/' + encodeURIComponent(itemId), { method: 'DELETE' });
                if (data.state) initStateFromServer(data.state);
            } else {
                list.items = (list.items || []).filter(function (x) {
                    return x.id !== itemId;
                });
                normalizePositions({ lists: [list] });
                persistGuest();
            }
        } catch (e) {
            toast(e.message || 'Could not delete task');
        }
        render();
    }

    async function init() {
        if (!document.getElementById('board')) {
            return;
        }
        if (taskbit.loggedIn) {
            initStateFromServer(taskbit.initialState || { notebooks: [] });
            try {
                await mergeGuestIfNeeded();
            } catch (e) {
                console.error(e);
            }
            if (state.notebooks.length === 0) {
                try {
                    const data = await api('/api/notebooks', {
                        method: 'POST',
                        body: JSON.stringify({ name: 'My Notebook' }),
                    });
                    if (data.state) initStateFromServer(data.state);
                    if (data.id) state.activeNotebookId = data.id;
                } catch (e) {
                    console.error(e);
                }
            }
        } else {
            state = loadGuestFromStorage() || defaultGuestState();
            persistGuest();
        }

        document.getElementById('btn-add-notebook')?.addEventListener('click', function () {
            addNotebook().catch(function (e) {
                toast(e.message || 'Error');
            });
        });
        document.getElementById('btn-add-list')?.addEventListener('click', function () {
            addList().catch(function (e) {
                toast(e.message || 'Error');
            });
        });
        document.getElementById('btn-rename-notebook')?.addEventListener('click', function () {
            renameActiveNotebook().catch(function (e) {
                toast(e.message || 'Error');
            });
        });

        bindViewportResizeForTitles();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            init().catch(function (e) {
                console.error(e);
                toast('Could not start app');
            });
        });
    } else {
        init().catch(function (e) {
            console.error(e);
            toast('Could not start app');
        });
    }
})();
