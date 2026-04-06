<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use TaskBit\Services\StateService;
use TaskBit\View;

final class AppController extends Controller
{
    public function index(array $params): void
    {
        $userId = $this->userId();
        $initialState = null;
        if ($userId !== null) {
            $initialState = StateService::forUser($userId);
        }
        header('Content-Type: text/html; charset=utf-8');
        echo View::render('layout', [
            'title' => 'TaskBit — Notebook',
            'body' => View::render('app', [
                'loggedIn' => $userId !== null,
                'username' => $_SESSION['username'] ?? null,
                'initialStateJson' => $initialState !== null
                    ? json_encode($initialState, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)
                    : 'null',
                'csrfToken' => $this->csrfToken(),
            ]),
        ]);
    }
}
