<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use TaskBit\Database;
use TaskBit\Http\JsonResponse;
use TaskBit\Http\Request;
use TaskBit\Services\StateService;

final class MergeController extends Controller
{
    public function merge(array $params): void
    {
        $uid = $this->requireAuth();
        try {
            $body = Request::jsonBody();
        } catch (\InvalidArgumentException) {
            JsonResponse::send(400, ['error' => 'Invalid JSON']);
            return;
        }
        $notebook = $body['notebook'] ?? null;
        if (!is_array($notebook)) {
            JsonResponse::send(400, ['error' => 'Missing notebook']);
            return;
        }
        $name = trim((string) ($notebook['name'] ?? 'Notes'));
        if ($name === '') {
            $name = 'Imported';
        }
        $lists = $notebook['lists'] ?? [];
        if (!is_array($lists)) {
            $lists = [];
        }

        $pdo = Database::pdo();
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('SELECT COALESCE(MAX(position), -1) + 1 FROM notebooks WHERE user_id = ?');
            $stmt->execute([$uid]);
            $nbPos = (int) $stmt->fetchColumn();
            $stmt = $pdo->prepare('INSERT INTO notebooks (user_id, name, position) VALUES (?, ?, ?)');
            $stmt->execute([$uid, $name, $nbPos]);
            $notebookId = (int) $pdo->lastInsertId();

            $lp = 0;
            foreach ($lists as $listData) {
                if (!is_array($listData)) {
                    continue;
                }
                $lname = trim((string) ($listData['name'] ?? 'List'));
                if ($lname === '') {
                    $lname = 'List';
                }
                $stmt = $pdo->prepare('INSERT INTO todo_lists (notebook_id, name, position) VALUES (?, ?, ?)');
                $stmt->execute([$notebookId, $lname, $lp]);
                $listId = (int) $pdo->lastInsertId();
                $items = $listData['items'] ?? [];
                if (!is_array($items)) {
                    $items = [];
                }
                $ip = 0;
                foreach ($items as $itemData) {
                    if (!is_array($itemData)) {
                        continue;
                    }
                    $title = trim((string) ($itemData['title'] ?? ''));
                    if ($title === '') {
                        continue;
                    }
                    $completed = !empty($itemData['completed']) ? 1 : 0;
                    $stmt = $pdo->prepare(
                        'INSERT INTO todo_items (list_id, title, completed, position) VALUES (?, ?, ?, ?)'
                    );
                    $stmt->execute([$listId, $title, $completed, $ip]);
                    $ip++;
                }
                $lp++;
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            JsonResponse::send(500, ['error' => 'Merge failed']);
            return;
        }
        JsonResponse::send(200, [
            'ok' => true,
            'notebook_id' => $notebookId,
            'state' => StateService::forUser($uid),
        ]);
    }
}
