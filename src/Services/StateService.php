<?php

declare(strict_types=1);

namespace TaskBit\Services;

use TaskBit\Database;

final class StateService
{
    /**
     * @return array<string, mixed>
     */
    public static function forUser(int $userId): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT id, name, position, created_at FROM notebooks WHERE user_id = ? ORDER BY position ASC, id ASC'
        );
        $stmt->execute([$userId]);
        $notebooks = $stmt->fetchAll();
        $ids = array_map(fn ($n) => (int) $n['id'], $notebooks);
        if ($ids === []) {
            return ['notebooks' => []];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        $lStmt = $pdo->prepare(
            "SELECT id, notebook_id, name, position, created_at FROM todo_lists WHERE notebook_id IN ($placeholders) ORDER BY notebook_id ASC, position ASC, id ASC"
        );
        $lStmt->execute($ids);
        $lists = $lStmt->fetchAll();

        $listIds = array_map(fn ($l) => (int) $l['id'], $lists);
        $itemsByList = [];
        if ($listIds !== []) {
            $lp = implode(',', array_fill(0, count($listIds), '?'));
            $iStmt = $pdo->prepare(
                "SELECT id, list_id, title, completed, position, created_at FROM todo_items WHERE list_id IN ($lp) ORDER BY list_id ASC, position ASC, id ASC"
            );
            $iStmt->execute($listIds);
            foreach ($iStmt->fetchAll() as $row) {
                $lid = (int) $row['list_id'];
                if (!isset($itemsByList[$lid])) {
                    $itemsByList[$lid] = [];
                }
                $itemsByList[$lid][] = [
                    'id' => (int) $row['id'],
                    'title' => $row['title'],
                    'completed' => (bool) $row['completed'],
                    'position' => (int) $row['position'],
                    'created_at' => $row['created_at'],
                ];
            }
        }

        $listsByNotebook = [];
        foreach ($lists as $row) {
            $nid = (int) $row['notebook_id'];
            if (!isset($listsByNotebook[$nid])) {
                $listsByNotebook[$nid] = [];
            }
            $lid = (int) $row['id'];
            $listsByNotebook[$nid][] = [
                'id' => $lid,
                'name' => $row['name'],
                'position' => (int) $row['position'],
                'created_at' => $row['created_at'],
                'items' => $itemsByList[$lid] ?? [],
            ];
        }

        $out = [];
        foreach ($notebooks as $n) {
            $nid = (int) $n['id'];
            $out[] = [
                'id' => $nid,
                'name' => $n['name'],
                'position' => (int) $n['position'],
                'created_at' => $n['created_at'],
                'lists' => $listsByNotebook[$nid] ?? [],
            ];
        }

        return ['notebooks' => $out];
    }
}
