# 0006 : Un instant se range en UTC, une journée se compte à Madagascar

- Date : 2026-10-06
- Statut : Accepté, par l'Académie

## Le problème

Un membre gratuit a droit à un nombre de likes par jour. Mais quel jour ? Le
serveur peut tourner en Europe ou aux États-Unis, et l'heure de son horloge
n'est pas celle de Madagascar. Un compteur qui repart à zéro à minuit UTC
repartirait à 3 heures du matin à Antananarivo.

## La décision

**Un instant se range dans une colonne `timestamptz`**, qui garde un point
précis dans le temps, quel que soit le fuseau du serveur.

**Une journée se compte à l'heure de Madagascar**, le fuseau
`Indian/Antananarivo`, soit UTC+3, sans heure d'été. Les likes du jour sont
ceux dont l'instant tombe entre minuit et minuit, heure de Madagascar. Le
compteur repart donc à zéro à 21 h 00 UTC.

Comme pour l'âge, l'instant présent est passé en paramètre au lieu d'être lu
sur l'horloge.

## Ce que ça coûte

Il faut convertir avant de comparer, et ne jamais découper une date avec
`toISOString()`, qui donne la date en UTC : la veille, entre minuit et 3 heures
du matin à Madagascar.

## Ce qui a été écarté

**Un compteur sur les 24 dernières heures.** Il est juste, mais personne ne
sait à quelle heure ses likes reviennent. « À minuit » se comprend sans
explication.
