# One image, one process: the ASP.NET Core API also serves the compiled Angular app.

# ---- 1. Build the Angular client ------------------------------------------------------
FROM node:22-alpine AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npx ng build --configuration production

# ---- 2. Build and test the .NET solution ----------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
# Restore first, in its own layer, so code edits don't invalidate the package cache.
COPY global.json Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/MortgageAnalytics.Domain/*.csproj src/MortgageAnalytics.Domain/
COPY src/MortgageAnalytics.Application/*.csproj src/MortgageAnalytics.Application/
COPY src/MortgageAnalytics.Infrastructure/*.csproj src/MortgageAnalytics.Infrastructure/
COPY src/MortgageAnalytics.Api/*.csproj src/MortgageAnalytics.Api/
RUN dotnet restore src/MortgageAnalytics.Api/MortgageAnalytics.Api.csproj
COPY src/ src/
RUN dotnet publish src/MortgageAnalytics.Api/MortgageAnalytics.Api.csproj -c Release -o /app --no-restore

# ---- 3. Runtime image -----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=api /app ./
COPY --from=client /client/dist/client/browser ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
# Saved calculations live in a SQLite file under /data; mount a volume there to keep them.
RUN mkdir -p /data && chown app:app /data
ENV ConnectionStrings__Calculations="Data Source=/data/calculations.db"
# Signing keys for sessions and emailed links, and the outbox (when no mail server is set), also live in /data.
ENV DataProtection__KeysDirectory=/data/keys
ENV Email__OutboxDirectory=/data/outbox
VOLUME /data
# Run as the non-root user that ships with the .NET images.
USER app
ENTRYPOINT ["dotnet", "MortgageAnalytics.Api.dll"]
