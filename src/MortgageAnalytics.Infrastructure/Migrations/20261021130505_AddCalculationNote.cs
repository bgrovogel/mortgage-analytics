using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MortgageAnalytics.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCalculationNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "SavedCalculations",
                type: "TEXT",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Note",
                table: "SavedCalculations");
        }
    }
}
