# Ambiente de desenvolvimento em container

O projeto usa a [imagem oficial de desenvolvimento para TypeScript e Node.js 22](https://github.com/devcontainers/images/blob/main/src/typescript-node/README.md), baseada em Debian Bookworm. Na primeira criação, `npm ci` instala as dependências a partir de `package-lock.json`.

O usuário remoto é `root` para funcionar com o Docker **rootless** deste ambiente: nesse modo, o UID 0 do container corresponde ao usuário que executa o Docker no host, e o usuário `node` não tem acesso de escrita ao diretório montado. Em um Docker convencional (rootful), arquivos criados pelo container podem ficar pertencendo a `root` no host; nesse caso, ajuste o usuário remoto e as permissões ao ambiente antes de trabalhar.

## Abrir o projeto

1. Instale e inicie o Docker e instale a extensão **Dev Containers** no VS Code.
2. Abra a pasta do projeto no VS Code.
3. Execute **Dev Containers: Reopen in Container** e aguarde a instalação das dependências.
4. No terminal do container, compile o projeto com `npm run build`.

Para iniciar o servidor manualmente, configure `FREELANCER_OAUTH_TOKEN` no ambiente do processo e execute `npm start` após compilar. O servidor usa MCP sobre entrada e saída padrão e aguarda a conexão de um cliente MCP; não há porta HTTP para publicar. Configure o token também no ambiente do cliente MCP que iniciar o servidor. Não salve credenciais no repositório nem as compartilhe no chat.

Se as dependências mudarem, execute `npm ci` novamente. Para recriar o ambiente, use **Dev Containers: Rebuild Container**.
