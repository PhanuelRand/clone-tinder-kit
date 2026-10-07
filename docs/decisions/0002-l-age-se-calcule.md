# 0002 : L'âge se calcule, il ne se stocke pas

- Date : 2026-10-06
- Statut : Accepté, par l'Académie

## Le problème

Un âge rangé dans la base est faux le lendemain de l'anniversaire. Et une
application de rencontres doit refuser les mineurs : elle a besoin de savoir,
au jour près, si quelqu'un a 18 ans.

## La décision

**La base garde la date de naissance, dans une colonne de type `date`.** L'âge
se calcule à la demande, à partir de la date du jour, que le code reçoit en
paramètre au lieu de la lire sur l'horloge. C'est ce qui permet de vérifier
qu'un membre a 17 ans la veille de son anniversaire et 18 ans le jour même.

Une personne née un 29 février prend un an le 1er mars les années qui n'ont
pas de 29 février.

Un membre a 18 ans au moins. La date de naissance n'est jamais montrée aux
autres membres : ils voient l'âge.

## Ce que ça coûte

Chaque requête qui filtre par âge doit faire un calcul de dates, et le code
doit faire circuler la date du jour jusqu'à elle.

## Ce qui a été écarté

**Diviser par 365 le nombre de jours depuis la naissance.** Les années
bissextiles décalent le résultat d'un jour tous les quatre ans : un membre
aurait 18 ans la veille de son anniversaire.
