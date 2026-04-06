<?php
/** @var string|null $error */
/** @var string $csrfToken */
?>
<main class="auth-wrap">
    <div class="auth-card sheet-rise">
        <h1 class="auth-title">Create account</h1>
        <?php if (!empty($error)): ?>
            <p class="auth-error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
        <?php endif; ?>
        <form method="post" action="/register" class="auth-form">
            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
            <label class="field">
                <span>Username</span>
                <input type="text" name="username" required autocomplete="username" minlength="2">
            </label>
            <label class="field">
                <span>Email</span>
                <input type="email" name="email" required autocomplete="email">
            </label>
            <label class="field">
                <span>Password (8+)</span>
                <input type="password" name="password" required autocomplete="new-password" minlength="8">
            </label>
            <button type="submit" class="btn btn-primary btn-block">Register</button>
        </form>
        <p class="auth-footer">Have an account? <a href="/login">Sign in</a> · <a href="/">Guest mode</a></p>
    </div>
</main>
