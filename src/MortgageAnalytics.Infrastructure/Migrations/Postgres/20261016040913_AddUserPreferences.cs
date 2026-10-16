using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MortgageAnalytics.Infrastructure.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class AddUserPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserPreferences",
                columns: table => new
                {
                    OwnerId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    KeyFigureOrder = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false),
                    KeyFiguresHidden = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPreferences", x => x.OwnerId);
                    table.ForeignKey(
                        name: "FK_UserPreferences_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserPreferences");
        }
    }
}
