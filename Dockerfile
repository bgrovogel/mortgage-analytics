# One image, one process: the ASP.NET Core API also serves the compiled Angular app.

# ---- 1. Build the Angular client ------------------------------------------------------
FROM node:22-alpine AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npx ng build --configuration production

# ---- 2. Build and test the .NET solution ----------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS api
WORKDIR /src
# Restore first, in its own layer, so code edits don't invalidate the package cache.
COPY Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/MortgageAnalytics.Domain/*.csproj src/MortgageAnalytics.Domain/
COPY src/MortgageAnalytics.Application/*.csproj src/MortgageAnalytics.Application/
COPY src/MortgageAnalytics.Api/*.csproj src/MortgageAnalytics.Api/
RUN dotnet restore src/MortgageAnalytics.Api/MortgageAnalytics.Api.csproj
COPY src/ src/
RUN dotnet publish src/MortgageAnalytics.Api/MortgageAnalytics.Api.csproj -c Release -o /app --no-restore

# ---- 3. Runtime image -----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=api /app ./
COPY --from=client /client/dist/client/browser ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
# Run as the non-root user that ships with the .NET images.
USER app
ENTRYPOINT ["dotnet", "MortgageAnalytics.Api.dll"]
