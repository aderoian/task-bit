<?php
/** @var bool $loggedIn */
/** @var string|null $username */
/** @var string $initialStateJson */
/** @var string $csrfToken */
?>
<script>
window.TASKBIT = {
    loggedIn: <?= $loggedIn ? 'true' : 'false' ?>,
    username: <?= json_encode($username, JSON_THROW_ON_ERROR) ?>,
    initialState: <?= $initialStateJson ?>,
    csrfToken: <?= json_encode($csrfToken, JSON_THROW_ON_ERROR) ?>
};
</script>

<header class="top-bar sheet-rise">
    <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <h1 class="brand-title">TaskBit</h1>
        <span class="brand-tag">notebook todos</span>
    </div>
    <nav class="nav-actions">
        <?php if ($loggedIn): ?>
            <span class="user-chip"><?= htmlspecialchars((string) $username, ENT_QUOTES, 'UTF-8') ?></span>
            <form class="inline-form" method="post" action="/logout">
                <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                <button type="submit" class="btn btn-ghost">Sign out</button>
            </form>
        <?php else: ?>
            <a class="btn btn-ghost" href="/login">Sign in</a>
            <a class="btn btn-primary" href="/register">Register</a>
        <?php endif; ?>
    </nav>
</header>

<main class="main-wrap">
    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <section class="notebook-shell sheet-rise">
        <div class="notebook-inner">
            <div class="spiral" aria-hidden="true"></div>
            <div class="notebook-body">
                <div id="guest-banner" class="guest-banner hidden">
                    <p>You're using a local-only notebook (max <strong>3 lists</strong>). Sign in to sync everywhere.</p>
                </div>
                <div id="notebook-tabs" class="notebook-tabs"></div>
                <div class="notebook-toolbar">
                    <button type="button" id="btn-add-notebook" class="btn btn-small btn-secondary hidden">+ Notebook</button>
                    <button type="button" id="btn-add-list" class="btn btn-small btn-primary">+ List</button>
                    <button type="button" id="btn-rename-notebook" class="btn btn-small btn-ghost hidden">Rename notebook</button>
                </div>
                <div id="board" class="board"></div>
            </div>
        </div>
    </section>
</main>
