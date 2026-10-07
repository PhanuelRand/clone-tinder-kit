# 0001 : Une paire de membres se range dans un seul sens

- Date : 2026-10-06
- Statut : Accepté, par l'Académie

## Le problème

Un match relie deux membres, Hery et Voahangy. Si la base le range une fois
comme « Hery, Voahangy » et une autre fois comme « Voahangy, Hery », elle croit
tenir deux matchs différents. Une contrainte d'unicité sur les deux colonnes ne
voit alors aucun doublon, et la conversation se dédouble.

## La décision

**Une paire se range toujours avec le plus petit identifiant d'abord.** Le
code calcule cet ordre avant d'écrire, et la table le vérifie par une
contrainte `check (membre_a < membre_b)`. Une contrainte d'unicité sur
`(membre_a, membre_b)` garantit alors un seul match par paire.

Un like, lui, a un sens : il va de quelqu'un vers quelqu'un. Il se range tel
quel, avec son auteur et son destinataire.

## Ce que ça coûte

Pour retrouver les matchs d'un membre, la requête cherche dans les deux
colonnes : `where membre_a = $1 or membre_b = $1`. Et l'interface doit savoir
lequel des deux est « l'autre ».

## Ce qui a été écarté

**Ranger chaque match deux fois, une par membre.** Les lectures sont plus
simples, mais chaque écriture doit en faire deux, et le jour où l'une des deux
échoue, Hery voit un match que Voahangy ne voit pas.
