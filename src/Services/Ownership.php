<?php

declare(strict_types=1);

namespace TaskBit\Services;

use TaskBit\Database;
use PDO;

final class Ownership
{
    public static function notebookBelongsToUser(int $notebookId, int $userId): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT 1 FROM notebooks WHERE id = ? AND user_id = ?');
        $stmt->execute([$notebookId, $userId]);
        return (bool) $stmt->fetchColumn();
    }

    public static function listBelongsToUser(int $listId, int $userId): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT 1 FROM todo_lists tl
             INNER JOIN notebooks n ON n.id = tl.notebook_id
             WHERE tl.id = ? AND n.user_id = ?'
        );
        $stmt->execute([$listId, $userId]);
        return (bool) $stmt->fetchColumn();
    }

    public static function itemBelongsToUser(int $itemId, int $userId): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT 1 FROM todo_items ti
             INNER JOIN todo_lists tl ON tl.id = ti.list_id
             INNER JOIN notebooks n ON n.id = tl.notebook_id
             WHERE ti.id = ? AND n.user_id = ?'
        );
        $stmt->execute([$itemId, $userId]);
        return (bool) $stmt->fetchColumn();
    }

    /** @return int|null notebook id */
    public static function notebookIdForList(int $listId): ?int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT notebook_id FROM todo_lists WHERE id = ?');
        $stmt->execute([$listId]);
        $v = $stmt->fetchColumn();
        return $v !== false ? (int) $v : null;
    }
}
