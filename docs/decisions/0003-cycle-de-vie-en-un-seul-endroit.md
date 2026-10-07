# 0003 : Un seul endroit décide des passages

- Date : 2026-10-06
- Statut : Accepté, par l'Académie

## Le problème

Entre deux membres, une relation traverse plusieurs situations : un like en
attente de réponse, un match, un refus, un match défait, un blocage. Si
plusieurs fichiers se permettent de changer cette situation, chacun applique sa
propre lecture des règles.

On voit alors un match défait qui se refait tout seul, ou une conversation
rouverte après un blocage, sans pouvoir dire quel fichier en est la cause.

## La décision

**Les passages autorisés sont décrits dans un seul objet, et une seule méthode
les applique.** Elle lève une erreur quand le passage demandé n'est pas permis.
Aucun autre code ne modifie la situation d'une relation.

Un blocage est définitif : aucune situation n'en sort.

## Ce que ça coûte

Un détour : un service qui veut défaire un match ne peut pas écrire le nouvel
état directement, il doit passer par cette méthode.

## Ce qui a été écarté

**Un `if` à chaque endroit qui change l'état.** C'est plus rapide à écrire les
trois premières fois. Au dixième, plus personne ne sait quelles règles
s'appliquent réellement, et les corriger demande de toutes les retrouver.
