using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MortgageAnalytics.Infrastructure.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class PostgresCompareUpToFourHomes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SecondHome",
                table: "SavedCalculations",
                newName: "OtherHomes");

            // Added by hand: a saved second home becomes a list of one.
            migrationBuilder.Sql("""UPDATE "SavedCalculations" SET "OtherHomes" = '[' || "OtherHomes" || ']' WHERE "OtherHomes" IS NOT NULL""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Added by hand: back to one second home, the first of the list (a third or fourth home is lost).
            migrationBuilder.Sql("""UPDATE "SavedCalculations" SET "OtherHomes" = ("OtherHomes"::jsonb -> 0)::text WHERE "OtherHomes" IS NOT NULL""");

            migrationBuilder.RenameColumn(
                name: "OtherHomes",
                table: "SavedCalculations",
                newName: "SecondHome");
        }
    }
}
