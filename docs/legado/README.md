# Legado: mascote "bolha" do Echo

Até 06/10/2026 o Echo usava um mascote em forma de "bolha" (superelipse clara com olhos, boca `_`/`o`,
bochechas e mãos redondas). Ele foi trocado pelo robô (`public/robo-motor.js` e `public/robo-roupas.js`).

## O que foi guardado

- **Código:** `mascote-bolha.js`, cópia sem alteração do trecho do `public/app.js` com os helpers de desenho,
  os sons (`Snd`), a especificação (`MOCHI_SPEC`), os estados, as expressões e a classe `Bot`.
- **Estado completo do app:** a tag git `mascote-bolha` aponta para o último commit com a bolha
  (`b7feb47`), com `app.js`, `index.html`, `styles.css` e testes daquele momento.

## Como restaurar

Ver o Echo antigo sem mexer no projeto (pasta separada):

```bash
git worktree add ../echo-bolha mascote-bolha
```

Voltar a bolha no projeto atual (desfaz a troca do personagem nesses arquivos; conferir o diff antes do commit):

```bash
git checkout mascote-bolha -- public/app.js public/index.html public/styles.css public/sw.js
```

O `server.js` atual continua compatível: a bolha não usa os arquivos do robô.

## Licença

O motor de animação deriva do motor MIT do Coucou (https://github.com/Louis-CFM/coucou). A aparência da
bolha lembra o Mochi, personagem reservado pela licença do Coucou: o backup serve como referência e
restauração do Echo pessoal, não para publicar a bolha como personagem próprio.
