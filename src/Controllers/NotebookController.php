<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use TaskBit\Database;
use TaskBit\Http\JsonResponse;
use TaskBit\Http\Request;
use TaskBit\Services\Ownership;
use TaskBit\Services\StateService;

final class NotebookController extends Controller
{
    public function create(array $params): void
    {
        $uid = $this->requireAuth();
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            JsonResponse::send(400, ['error' => 'Name required']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT COALESCE(MAX(position), -1) + 1 FROM notebooks WHERE user_id = ?');
        $stmt->execute([$uid]);
        $pos = (int) $stmt->fetchColumn();
        $stmt = $pdo->prepare('INSERT INTO notebooks (user_id, name, position) VALUES (?, ?, ?)');
        $stmt->execute([$uid, $name, $pos]);
        $id = (int) $pdo->lastInsertId();
        JsonResponse::send(201, ['id' => $id, 'state' => StateService::forUser($uid)]);
    }

    public function update(array $params): void
    {
        $uid = $this->requireAuth();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0 || !Ownership::notebookBelongsToUser($id, $uid)) {
            JsonResponse::send(404, ['error' => 'Not found']);
            return;
        }
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            JsonResponse::send(400, ['error' => 'Name required']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('UPDATE notebooks SET name = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$name, $id, $uid]);
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }

    public function delete(array $params): void
    {
        $uid = $this->requireAuth();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0 || !Ownership::notebookBelongsToUser($id, $uid)) {
            JsonResponse::send(404, ['error' => 'Not found']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('DELETE FROM notebooks WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $uid]);
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }
}
