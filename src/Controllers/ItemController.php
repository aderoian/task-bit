<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use TaskBit\Database;
use TaskBit\Http\JsonResponse;
use TaskBit\Http\Request;
use TaskBit\Services\Ownership;
use TaskBit\Services\StateService;

final class ItemController extends Controller
{
    public function create(array $params): void
    {
        $uid = $this->requireAuth();
        $listId = (int) ($params['listId'] ?? 0);
        if ($listId <= 0 || !Ownership::listBelongsToUser($listId, $uid)) {
            JsonResponse::send(404, ['error' => 'List not found']);
            return;
        }
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $title = trim((string) ($body['title'] ?? ''));
        if ($title === '') {
            JsonResponse::send(400, ['error' => 'Title required']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT COALESCE(MAX(position), -1) + 1 FROM todo_items WHERE list_id = ?');
        $stmt->execute([$listId]);
        $pos = (int) $stmt->fetchColumn();
        $stmt = $pdo->prepare(
            'INSERT INTO todo_items (list_id, title, completed, position) VALUES (?, ?, 0, ?)'
        );
        $stmt->execute([$listId, $title, $pos]);
        $id = (int) $pdo->lastInsertId();
        JsonResponse::send(201, ['id' => $id, 'state' => StateService::forUser($uid)]);
    }

    public function update(array $params): void
    {
        $uid = $this->requireAuth();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0 || !Ownership::itemBelongsToUser($id, $uid)) {
            JsonResponse::send(404, ['error' => 'Not found']);
            return;
        }
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $sets = [];
        $vals = [];
        if (array_key_exists('title', $body)) {
            $t = trim((string) $body['title']);
            if ($t === '') {
                JsonResponse::send(400, ['error' => 'Title cannot be empty']);
                return;
            }
            $sets[] = 'title = ?';
            $vals[] = $t;
        }
        if (array_key_exists('completed', $body)) {
            $sets[] = 'completed = ?';
            $vals[] = !empty($body['completed']) ? 1 : 0;
        }
        if ($sets === []) {
            JsonResponse::send(400, ['error' => 'No fields to update']);
            return;
        }
        $vals[] = $id;
        $pdo = Database::pdo();
        $sql = 'UPDATE todo_items SET ' . implode(', ', $sets) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($vals);
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }

    public function delete(array $params): void
    {
        $uid = $this->requireAuth();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0 || !Ownership::itemBelongsToUser($id, $uid)) {
            JsonResponse::send(404, ['error' => 'Not found']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('DELETE FROM todo_items WHERE id = ?');
        $stmt->execute([$id]);
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }
}
