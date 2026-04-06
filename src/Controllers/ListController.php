<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use TaskBit\Database;
use TaskBit\Http\JsonResponse;
use TaskBit\Http\Request;
use TaskBit\Services\Ownership;
use TaskBit\Services\StateService;

final class ListController extends Controller
{
    public function create(array $params): void
    {
        $uid = $this->requireAuth();
        $notebookId = (int) ($params['notebookId'] ?? 0);
        if ($notebookId <= 0 || !Ownership::notebookBelongsToUser($notebookId, $uid)) {
            JsonResponse::send(404, ['error' => 'Notebook not found']);
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
        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 FROM todo_lists WHERE notebook_id = ?'
        );
        $stmt->execute([$notebookId]);
        $pos = (int) $stmt->fetchColumn();
        $stmt = $pdo->prepare('INSERT INTO todo_lists (notebook_id, name, position) VALUES (?, ?, ?)');
        $stmt->execute([$notebookId, $name, $pos]);
        $id = (int) $pdo->lastInsertId();
        JsonResponse::send(201, ['id' => $id, 'state' => StateService::forUser($uid)]);
    }

    public function update(array $params): void
    {
        $uid = $this->requireAuth();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0 || !Ownership::listBelongsToUser($id, $uid)) {
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
        $stmt = $pdo->prepare('UPDATE todo_lists SET name = ? WHERE id = ?');
        $stmt->execute([$name, $id]);
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }

    public function delete(array $params): void
    {
        $uid = $this->requireAuth();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0 || !Ownership::listBelongsToUser($id, $uid)) {
            JsonResponse::send(404, ['error' => 'Not found']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('DELETE FROM todo_lists WHERE id = ?');
        $stmt->execute([$id]);
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }
}
