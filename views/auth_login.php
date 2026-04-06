<?php
/** @var string|null $error */
/** @var string $csrfToken */
?>
<main class="auth-wrap">
    <div class="auth-card sheet-rise">
        <h1 class="auth-title">Sign in</h1>
        <?php if (!empty($error)): ?>
            <p class="auth-error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
        <?php endif; ?>
        <form method="post" action="/login" class="auth-form">
            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
            <label class="field">
                <span>Username or email</span>
                <input type="text" name="identifier" required autocomplete="username">
            </label>
            <label class="field">
                <span>Password</span>
                <input type="password" name="password" required autocomplete="current-password">
            </label>
            <button type="submit" class="btn btn-primary btn-block">Sign in</button>
        </form>
        <p class="auth-footer">No account? <a href="/register">Register</a> · <a href="/">Continue as guest</a></p>
    </div>
</main>
