<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

abstract class Controller
{
    protected function userId(): ?int
    {
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    }

    protected function requireAuth(): int
    {
        $id = $this->userId();
        if ($id === null) {
            \TaskBit\Http\JsonResponse::send(401, ['error' => 'Unauthorized']);
            exit;
        }
        return $id;
    }

    protected function csrfToken(): string
    {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    protected function validateCsrf(): bool
    {
        $token = $_POST['_csrf'] ?? '';
        return is_string($token) && hash_equals($_SESSION['csrf_token'] ?? '', $token);
    }
}
