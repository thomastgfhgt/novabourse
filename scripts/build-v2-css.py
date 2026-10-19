# Génère css/v2.css à partir de la maquette novatitre-v2.html (design v2,
# 2026-10-19). Préfixe chaque classe (.card -> .v-card), chaque variable
# (--bg -> --v-bg) et chaque @keyframes (pageIn -> v-pageIn) pour que le
# design de la maquette cohabite sans collision avec styles.css.
# Les règles sur des éléments nus (button, input, *, html, body) sont
# limitées à l'intérieur de .v-page / .v-shell, jamais globales.
#
# Usage : python scripts/build-v2-css.py <maquette.html> css/v2.css
import re, sys

src = open(sys.argv[1], encoding='utf-8').read()
css = src[src.index('<style>') + 7: src.index('</style>')]

# Variables
css = re.sub(r'--([a-zA-Z][\w-]*)', r'--v-\1', css)

# Keyframes et leurs usages
names = set(re.findall(r'@keyframes\s+([\w-]+)', css))
for n in names:
    css = re.sub(r'@keyframes\s+%s\b' % n, '@keyframes v-' + n, css)
    css = re.sub(r'(animation(?:-name)?\s*:[^;}]*?)\b%s\b' % n, lambda m: m.group(1) + 'v-' + n, css)

SCOPE = '.v-shell'
ELEMENTS = ('html', 'body', 'button', 'input', 'a', '*')

def prefix_selector(sel):
    sel = sel.strip()
    if not sel:
        return sel
    # classes .x -> .v-x (hors valeurs numériques type .5)
    sel = re.sub(r'\.(?=[a-zA-Z_])', '.v-', sel)
    # sélecteurs commençant par un élément nu ou * : limités au shell v2
    head = re.split(r'[\s>+~:.\[#]', sel, 1)[0]
    if head in ELEMENTS:
        if head in ('html', 'body'):
            return sel.replace(head, SCOPE, 1)
        # :where() = spécificité nulle : ne bat jamais une classe de styles.css
        # (ex. .btn) sur les pages pas encore converties.
        return ':where(' + SCOPE + ') ' + sel
    return sel

out = []
pos = 0
# Parcours simple bloc par bloc ; gère un niveau de @media / @keyframes.
def process(block):
    res = []
    i = 0
    while i < len(block):
        j = block.find('{', i)
        if j < 0:
            res.append(block[i:]); break
        head = block[i:j]
        if head.strip().startswith('@'):
            # trouve l'accolade fermante correspondante
            depth, k = 1, j + 1
            while depth and k < len(block):
                if block[k] == '{': depth += 1
                elif block[k] == '}': depth -= 1
                k += 1
            inner = block[j + 1:k - 1]
            if head.strip().startswith('@keyframes'):
                res.append(head + '{' + inner + '}')
            else:
                res.append(head + '{' + process(inner) + '}')
            i = k
            continue
        k = block.find('}', j)
        body = block[j:k + 1]
        # conserve les commentaires/espaces avant le sélecteur
        m = re.match(r'(\s*(?:/\*.*?\*/\s*)*)(.*)$', head, re.S)
        lead, sels = m.group(1), m.group(2)
        res.append(lead + ','.join(prefix_selector(s) for s in sels.split(',')) + body)
        i = k + 1
    return ''.join(res)

css = process(css)
# :root -> portée du shell v2
css = css.replace(':root{', SCOPE + '{', 1)

header = ('/* GÉNÉRÉ par scripts/build-v2-css.py depuis la maquette novatitre-v2.html\n'
          '   (design v2, 2026-10-19). Ne pas éditer à la main : les ajustements\n'
          '   propres au site vont dans css/v2-site.css. */\n')
open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write(header + css.strip() + '\n')
print('ok', len(css), 'caractères,', len(names), 'animations')
