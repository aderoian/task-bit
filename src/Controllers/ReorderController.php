<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use PDO;
use TaskBit\Database;
use TaskBit\Http\JsonResponse;
use TaskBit\Http\Request;
use TaskBit\Services\Ownership;
use TaskBit\Services\StateService;

final class ReorderController extends Controller
{
    public function notebooks(array $params): void
    {
        $uid = $this->requireAuth();
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $ids = $body['notebook_ids'] ?? null;
        if (!is_array($ids) || $ids === []) {
            JsonResponse::send(400, ['error' => 'notebook_ids required']);
            return;
        }
        $notebookIds = [];
        foreach ($ids as $x) {
            $notebookIds[] = (int) $x;
        }
        $unique = array_values(array_unique($notebookIds));
        if (count($unique) !== count($notebookIds)) {
            JsonResponse::send(400, ['error' => 'Duplicate notebook ids']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT id FROM notebooks WHERE user_id = ? ORDER BY id ASC');
        $stmt->execute([$uid]);
        $existing = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        sort($existing);
        sort($unique);
        if ($existing !== $unique) {
            JsonResponse::send(400, ['error' => 'Notebook ID set must match account']);
            return;
        }
        try {
            $pdo->beginTransaction();
            $pos = 0;
            $upd = $pdo->prepare('UPDATE notebooks SET position = ? WHERE id = ? AND user_id = ?');
            foreach ($notebookIds as $nid) {
                $upd->execute([$pos, $nid, $uid]);
                $pos++;
            }
            $pdo->commit();
        } catch (\Throwable) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            JsonResponse::send(500, ['error' => 'Reorder failed']);
            return;
        }
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }

    public function lists(array $params): void
    {
        $uid = $this->requireAuth();
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $notebookId = (int) ($body['notebook_id'] ?? 0);
        $ids = $body['list_ids'] ?? null;
        if ($notebookId <= 0 || !is_array($ids) || $ids === []) {
            JsonResponse::send(400, ['error' => 'notebook_id and list_ids required']);
            return;
        }
        if (!Ownership::notebookBelongsToUser($notebookId, $uid)) {
            JsonResponse::send(404, ['error' => 'Notebook not found']);
            return;
        }
        $listIds = [];
        foreach ($ids as $x) {
            $listIds[] = (int) $x;
        }
        $unique = array_values(array_unique($listIds));
        if (count($unique) !== count($listIds)) {
            JsonResponse::send(400, ['error' => 'Duplicate list ids']);
            return;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT id FROM todo_lists WHERE notebook_id = ? ORDER BY id ASC');
        $stmt->execute([$notebookId]);
        $existing = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        $sorted = array_values(array_unique($listIds));
        sort($existing);
        sort($sorted);
        if ($existing !== $sorted) {
            JsonResponse::send(400, ['error' => 'List ID set must match notebook']);
            return;
        }
        foreach ($listIds as $lid) {
            if (!Ownership::listBelongsToUser($lid, $uid)) {
                JsonResponse::send(403, ['error' => 'Forbidden']);
                return;
            }
        }
        try {
            $pdo->beginTransaction();
            $pos = 0;
            $upd = $pdo->prepare('UPDATE todo_lists SET position = ? WHERE id = ? AND notebook_id = ?');
            foreach ($listIds as $lid) {
                $upd->execute([$pos, $lid, $notebookId]);
                $pos++;
            }
            $pdo->commit();
        } catch (\Throwable) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            JsonResponse::send(500, ['error' => 'Reorder failed']);
            return;
        }
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }

    public function items(array $params): void
    {
        $uid = $this->requireAuth();
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $updates = $body['updates'] ?? null;
        if (!is_array($updates) || $updates === []) {
            JsonResponse::send(400, ['error' => 'updates required']);
            return;
        }
        $pdo = Database::pdo();
        $normalized = [];
        foreach ($updates as $u) {
            if (!is_array($u)) {
                continue;
            }
            $normalized[] = [
                'id' => (int) ($u['id'] ?? 0),
                'list_id' => (int) ($u['list_id'] ?? 0),
                'position' => (int) ($u['position'] ?? 0),
            ];
        }
        if ($normalized === []) {
            JsonResponse::send(400, ['error' => 'Invalid updates']);
            return;
        }
        foreach ($normalized as $row) {
            if ($row['id'] <= 0 || $row['list_id'] <= 0) {
                JsonResponse::send(400, ['error' => 'Invalid id or list_id']);
                return;
            }
            if (!Ownership::itemBelongsToUser($row['id'], $uid)) {
                JsonResponse::send(404, ['error' => 'Item not found']);
                return;
            }
            if (!Ownership::listBelongsToUser($row['list_id'], $uid)) {
                JsonResponse::send(404, ['error' => 'List not found']);
                return;
            }
        }
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('UPDATE todo_items SET list_id = ?, position = ? WHERE id = ?');
            foreach ($normalized as $row) {
                $stmt->execute([$row['list_id'], $row['position'], $row['id']]);
            }
            $pdo->commit();
        } catch (\Throwable) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            JsonResponse::send(500, ['error' => 'Reorder failed']);
            return;
        }
        JsonResponse::send(200, ['ok' => true, 'state' => StateService::forUser($uid)]);
    }
}
