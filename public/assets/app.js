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
    const ui = {
        editingItemKey: null,
        editingListKey: null,
        pendingItemKey: null,
        pendingListKey: null,
    };

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

    function keyForList(notebookId, listId) {
        return String(notebookId) + '::' + String(listId);
    }

    function keyForItem(notebookId, listId, itemId) {
        return String(notebookId) + '::' + String(listId) + '::' + String(itemId);
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

    function itemTitleMaxHeightPx() {
        var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        var cssCap = Math.round(h - 7.5 * rootFs);
        return Math.max(96, cssCap);
    }

    var measureCanvas;
    function maxLinePx(el, text) {
        if (!measureCanvas) measureCanvas = document.createElement('canvas');
        const ctx = measureCanvas.getContext('2d');
        if (!ctx) return 0;
        const style = getComputedStyle(el);
        ctx.font = style.font || [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
        return String(text || '')
            .split('\n')
            .reduce(function (max, line) {
                return Math.max(max, Math.ceil(ctx.measureText(line || ' ').width));
            }, 0);
    }

    function itemTitleMaxWidthPx() {
        var w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        var cssCap = Math.round(w - 8.5 * rootFs);
        return Math.max(220, Math.min(560, cssCap));
    }

    function itemTitleContainerMaxWidthPx(el) {
        const row = el.closest('.todo-item');
        if (!row) return Infinity;
        const col = el.closest('.list-column');
        const colWidth = col ? col.clientWidth : 0;
        if (!colWidth) return Infinity;
        const rowStyle = getComputedStyle(row);
        const gap = parseFloat(rowStyle.columnGap || rowStyle.gap) || 0;
        const rowPad =
            (parseFloat(rowStyle.paddingLeft) || 0) +
            (parseFloat(rowStyle.paddingRight) || 0) +
            (parseFloat(rowStyle.borderLeftWidth) || 0) +
            (parseFloat(rowStyle.borderRightWidth) || 0);
        let occupied = 0;
        Array.from(row.children).forEach(function (child) {
            if (child === el) return;
            occupied += child.getBoundingClientRect().width;
        });
        const interItemGaps = Math.max(0, row.children.length - 1) * gap;
        return Math.max(120, Math.floor(colWidth - rowPad - occupied - interItemGaps - 2));
    }

    function autoResizeTextarea(el) {
        if (!el || el.tagName !== 'TEXTAREA') return;
        const style = getComputedStyle(el);
        const minW = Math.round((parseFloat(style.fontSize) || 16) * 8.5);
        const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        const border = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
        const textW = maxLinePx(el, el.value);
        const maxW = Math.min(itemTitleMaxWidthPx(), itemTitleContainerMaxWidthPx(el));
        const nextW = Math.min(Math.max(textW + pad + border + 8, minW), maxW);
        el.style.width = nextW + 'px';
        var max = itemTitleMaxHeightPx();
        el.style.height = 'auto';
        var sh = el.scrollHeight;
        var next = Math.min(sh, max);
        el.style.height = next + 'px';
        el.style.overflowY = sh > max ? 'auto' : 'hidden';
    }

    function setInlineReadonly(el, isReadonly) {
        el.readOnly = isReadonly;
        el.classList.toggle('is-readonly', isReadonly);
    }

    function focusAndSelect(el) {
        if (!el) return;
        try {
            el.focus({ preventScroll: true });
        } catch (_) {
            el.focus();
        }
        if (typeof el.select === 'function') {
            el.select();
            return;
        }
        if (typeof el.setSelectionRange === 'function') {
            el.setSelectionRange(0, String(el.value || '').length);
        }
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
            const handle = document.createElement('span');
            handle.className = 'icon-btn list-column-handle';
            handle.title = 'Reorder list';
            handle.setAttribute('aria-label', 'Reorder list');
            handle.textContent = '☰';
            const title = document.createElement('input');
            title.className = 'list-title-input';
            title.type = 'text';
            title.spellcheck = false;
            title.value = list.name || '';
            const listKey = keyForList(nb.id, list.id);
            title.dataset.listKey = listKey;
            setInlineReadonly(title, ui.editingListKey !== listKey);
            title.addEventListener('dblclick', function () {
                ui.editingListKey = listKey;
                setInlineReadonly(title, false);
                focusAndSelect(title);
            });
            title.addEventListener('keydown', function (ev) {
                if (ev.key === 'Escape' && !title.readOnly) {
                    ev.preventDefault();
                    title.dataset.cancelEdit = '1';
                    title.value = list.name || '';
                    title.blur();
                    return;
                }
                if (ev.key === 'Enter' && !ev.shiftKey && !title.readOnly) {
                    ev.preventDefault();
                    title.blur();
                }
            });
            title.addEventListener('blur', function () {
                if (title.dataset.cancelEdit === '1') {
                    title.dataset.cancelEdit = '';
                    ui.editingListKey = null;
                    setInlineReadonly(title, true);
                    return;
                }
                if (title.readOnly) return;
                updateListName(nb.id, list.id, title.value)
                    .catch(function (e) {
                        toast(e.message || 'Could not rename list');
                    })
                    .finally(function () {
                        ui.editingListKey = null;
                        render();
                    });
            });
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'icon-btn list-del';
            delBtn.title = 'Delete list';
            delBtn.textContent = '×';
            delBtn.addEventListener('click', function () {
                deleteList(list.id);
            });
            header.appendChild(handle);
            header.appendChild(title);
            header.appendChild(delBtn);

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
        const itemKey = keyForItem(nb.id, list.id, it.id);
        ta.dataset.itemKey = itemKey;
        setInlineReadonly(ta, ui.editingItemKey !== itemKey);
        if (ui.editingItemKey === itemKey) {
            row.classList.add('editing');
        }
        ta.addEventListener('input', function () {
            autoResizeTextarea(ta);
        });
        ta.addEventListener('dblclick', function () {
            ui.editingItemKey = itemKey;
            setInlineReadonly(ta, false);
            row.classList.add('editing');
            autoResizeTextarea(ta);
            focusAndSelect(ta);
        });
        ta.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape' && !ta.readOnly) {
                ev.preventDefault();
                ta.dataset.cancelEdit = '1';
                ta.value = it.title || '';
                autoResizeTextarea(ta);
                ta.blur();
                return;
            }
            if (ev.key === 'Enter' && !ev.shiftKey && !ta.readOnly) {
                ev.preventDefault();
                ta.blur();
            }
        });
        const check = row.querySelector('.item-check');
        check.addEventListener('change', function () {
            row.classList.toggle('done', check.checked);
            updateItemCompletion(nb.id, list.id, it.id, check.checked);
        });
        ta.addEventListener('blur', function () {
            if (ta.dataset.cancelEdit === '1') {
                ta.dataset.cancelEdit = '';
                ui.editingItemKey = null;
                setInlineReadonly(ta, true);
                row.classList.remove('editing');
                return;
            }
            if (ta.readOnly) return;
            updateItemTitle(nb.id, list.id, it.id, ta.value)
                .catch(function (e) {
                    toast(e.message || 'Could not save task');
                })
                .finally(function () {
                    ui.editingItemKey = null;
                    render();
                });
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

    function focusPendingInlineEditors() {
        if (ui.pendingListKey) {
            const key = ui.pendingListKey;
            ui.pendingListKey = null;
            ui.editingListKey = key;
            document.querySelectorAll('#board .list-title-input').forEach(function (el) {
                if (el.dataset.listKey === key) {
                    setInlineReadonly(el, false);
                    focusAndSelect(el);
                }
            });
        }
        if (ui.pendingItemKey) {
            const key = ui.pendingItemKey;
            ui.pendingItemKey = null;
            ui.editingItemKey = key;
            document.querySelectorAll('#board .item-title').forEach(function (el) {
                if (el.dataset.itemKey === key) {
                    setInlineReadonly(el, false);
                    autoResizeTextarea(el);
                    focusAndSelect(el);
                    const row = el.closest('.todo-item');
                    if (row) row.classList.add('editing');
                }
            });
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
        focusPendingInlineEditors();
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
        const trimmed = 'Untitled List';
        let createdListId = null;
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/notebooks/' + encodeURIComponent(nb.id) + '/lists', {
                    method: 'POST',
                    body: JSON.stringify({ name: trimmed }),
                });
                if (data.state) initStateFromServer(data.state);
                createdListId = data.id;
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
                createdListId = list.id;
            }
        } catch (e) {
            toast(e.message || 'Could not create list');
        }
        if (createdListId !== null) {
            ui.pendingListKey = keyForList(nb.id, createdListId);
        }
        render();
    }

    async function updateListName(notebookId, listId, name) {
        const list = findList(notebookId, listId);
        if (!list) return false;
        const trimmed = String(name).trim();
        if (!trimmed) {
            toast('List title cannot be empty.');
            return false;
        }
        if (trimmed === String(list.name || '').trim()) return true;
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
            return false;
        }
        return true;
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
        const trimmed = 'Untitled Task';
        let createdItemId = null;
        try {
            if (taskbit.loggedIn) {
                const data = await api('/api/lists/' + encodeURIComponent(listId) + '/items', {
                    method: 'POST',
                    body: JSON.stringify({ title: trimmed }),
                });
                if (data.state) initStateFromServer(data.state);
                createdItemId = data.id;
            } else {
                list.items = list.items || [];
                const item = {
                    id: uid('gi'),
                    title: trimmed,
                    completed: false,
                    position: list.items.length,
                };
                list.items.push(item);
                persistGuest();
                createdItemId = item.id;
            }
        } catch (e) {
            toast(e.message || 'Could not add task');
        }
        if (createdItemId !== null) {
            ui.pendingItemKey = keyForItem(nb.id, listId, createdItemId);
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
        if (!list) return false;
        const it = (list.items || []).find(function (x) {
            return x.id === itemId;
        });
        if (!it) return false;
        const trimmed = String(title).trim();
        if (!trimmed) {
            toast('Task title cannot be empty.');
            return false;
        }
        if (trimmed === String(it.title || '').trim()) return true;
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
                return false;
            }
        } else {
            persistGuest();
        }
        return true;
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
