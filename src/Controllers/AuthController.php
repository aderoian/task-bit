<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use TaskBit\Database;
use TaskBit\View;

final class AuthController extends Controller
{
    public function showLogin(array $params): void
    {
        if ($this->userId() !== null) {
            header('Location: /');
            exit;
        }
        header('Content-Type: text/html; charset=utf-8');
        echo View::render('layout', [
            'title' => 'Sign in — TaskBit',
            'body' => View::render('auth_login', [
                'error' => $_SESSION['flash_error'] ?? null,
                'csrfToken' => $this->csrfToken(),
            ]),
        ]);
        unset($_SESSION['flash_error']);
    }

    public function showRegister(array $params): void
    {
        if ($this->userId() !== null) {
            header('Location: /');
            exit;
        }
        header('Content-Type: text/html; charset=utf-8');
        echo View::render('layout', [
            'title' => 'Register — TaskBit',
            'body' => View::render('auth_register', [
                'error' => $_SESSION['flash_error'] ?? null,
                'csrfToken' => $this->csrfToken(),
            ]),
        ]);
        unset($_SESSION['flash_error']);
    }

    public function login(array $params): void
    {
        if (!$this->validateCsrf()) {
            $_SESSION['flash_error'] = 'Invalid session. Try again.';
            header('Location: /login');
            exit;
        }
        $identifier = trim((string) ($_POST['identifier'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        if ($identifier === '' || $password === '') {
            $_SESSION['flash_error'] = 'Please fill all fields.';
            header('Location: /login');
            exit;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT id, username, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1');
        $stmt->execute([$identifier, $identifier]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            $_SESSION['flash_error'] = 'Invalid credentials.';
            header('Location: /login');
            exit;
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $row['id'];
        $_SESSION['username'] = $row['username'];
        header('Location: /');
        exit;
    }

    public function register(array $params): void
    {
        if (!$this->validateCsrf()) {
            $_SESSION['flash_error'] = 'Invalid session. Try again.';
            header('Location: /register');
            exit;
        }
        $username = trim((string) ($_POST['username'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        if ($username === '' || $email === '' || strlen($password) < 8) {
            $_SESSION['flash_error'] = 'Username, email required; password min 8 characters.';
            header('Location: /register');
            exit;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $_SESSION['flash_error'] = 'Invalid email address.';
            header('Location: /register');
            exit;
        }
        $pdo = Database::pdo();
        $hash = password_hash($password, PASSWORD_DEFAULT);
        try {
            $stmt = $pdo->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
            $stmt->execute([$username, $email, $hash]);
        } catch (\PDOException $e) {
            if ($e->errorInfo[1] === 19 || str_contains($e->getMessage(), 'UNIQUE')) {
                $_SESSION['flash_error'] = 'Username or email already taken.';
            } else {
                $_SESSION['flash_error'] = 'Registration failed.';
            }
            header('Location: /register');
            exit;
        }
        $newId = (int) $pdo->lastInsertId();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $newId;
        $_SESSION['username'] = $username;
        header('Location: /');
        exit;
    }

    public function logout(array $params): void
    {
        if (!$this->validateCsrf()) {
            header('Location: /');
            exit;
        }
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], (bool) $p['secure'], (bool) $p['httponly']);
        }
        session_destroy();
        header('Location: /');
        exit;
    }
}
