# Como Contribuir para o Projeto

Agradecemos o seu interesse em contribuir! Siga as instruções abaixo para configurar o ambiente local, realizar alterações e submeter o seu Pull Request.

---

## 1. Clonar o Repositório

Comece por fazer clone do repositório para a sua máquina local:

```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DO_DIRETORIO>
```

---

## 2. Configurar Variáveis de Ambiente e Instalar Dependências

1. Copie o ficheiro de exemplo `.env.example` para criar o ficheiro `.env`:
   ```bash
   cp .env.example .env
   ```

2. Instale as dependências do projeto com o `npm` (ou `bun`):
   ```bash
   npm install
   ```

---

## 3. Executar e Testar Localmente

- **Iniciar o servidor de desenvolvimento:**
  ```bash
  npm run dev
  ```

- **Verificar erros de linting/tipagem:**
  ```bash
  npm run lint
  ```

- **Compilar o projeto para produção:**
  ```bash
  npm run build
  ```

---

## 4. Submeter um Pull Request (PR)

1. **Crie uma nova branch com um nome descritivo:**
   ```bash
   git checkout -b minha-funcionalidade
   ```

2. **Faça as alterações e valide com `npm run lint` antes do commit.**

3. **Crie os seus commits:**
   ```bash
   git add .
   git commit -m "feat: descrição sucinta da funcionalidade ou correção"
   ```

4. **Faça push para a sua branch remota:**
   ```bash
   git push origin minha-funcionalidade
   ```

5. **Abra um Pull Request:**
   - Aceda ao repositório no GitHub.
   - Clique em **New Pull Request** e selecione a sua branch.
   - Forneça uma breve descrição das alterações efetuadas e submeta para revisão.

---

Obrigado por contribuir!
